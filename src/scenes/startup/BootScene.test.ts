import { afterEach, beforeEach, expect, it, vi } from "vitest";

const startup = vi.hoisted(() => ({
  load: vi.fn(),
  mount: vi.fn(),
  prepare: vi.fn(),
  probe: vi.fn(),
  requireNewer: vi.fn(),
}));
const art = vi.hoisted(() => ({ add: vi.fn(), atlas: null as null | object }));
const manifest = vi.hoisted(() => ({
  backdrops: [],
  data: [],
  fonts: [{ fnt: "fonts/body.fnt", key: "font-body", png: "fonts/body.png" }],
  images: [{ key: "standalone-image", png: "images/standalone.png" }],
  sprites: [],
  tilesets: [],
}));
vi.mock("../../../public/art/manifest.json", () => ({ default: manifest }));
vi.mock("phaser", async () => {
  const { sceneStub } = await import("@andornaut/game-kit/test/phaser/sceneStub");
  return {
    Loader: {
      Events: {
        ADD: "addfile",
        COMPLETE: "complete",
        FILE_LOAD: "load",
        FILE_LOAD_ERROR: "loaderror",
        START: "start",
      },
    },
    Scene: class {
      constructor() {
        const stub = sceneStub(vi.fn);
        // The loader state the kit's loader watch reads.
        Object.assign(stub.load, {
          isLoading: () => false,
          list: new Set(),
          maxRetries: 2,
          start: vi.fn(),
          xhr: { timeout: 30000 },
        });
        Object.assign(this, stub);
      }
    },
    Scenes: { Events: { DESTROY: "destroy", SHUTDOWN: "shutdown" } },
    Textures: { FilterMode: { LINEAR: 0, NEAREST: 1 } },
  };
});
vi.mock("../save.ts", () => ({ loadProgress: startup.load, probeSaveAge: startup.probe }));
vi.mock("../../pwa/index.ts", async () => {
  const { createRequiredUpdate } = await import("../../pwa/requiredUpdate.ts");
  return { requireNewer: startup.requireNewer, requiredUpdate: createRequiredUpdate() };
});
vi.mock("../domUi.ts", () => ({
  mountSceneView: startup.mount,
  prepareDomUi: startup.prepare,
}));
vi.mock("../../ui/index.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../ui/index.ts")>()),
  createMessageCard: (_document: unknown, id: string, text: string) => ({ id, text }),
}));
vi.mock("./atlasArt.ts", () => ({
  get ATLAS() {
    return art.atlas;
  },
  addAtlasArt: art.add,
  queueAtlasPages: vi.fn(),
}));

import {
  type ArtManifest,
  type AtlasManifest,
  atlasPageKey,
  BUNDLED_ART_DATA,
} from "../../assets/index.ts";
import { TEXT } from "../../data/text.ts";
import { backgroundProgress, loadingProgress } from "../../loading/progress.ts";
import { requiredUpdate } from "../../pwa/index.ts";
import { UI_FRAMES } from "../../ui/index.ts";
import { BootScene } from "./BootScene.ts";
import * as textureArt from "./textureFilters.ts";

const bootScenes: BootScene[] = [];
function bootScene(signal?: AbortSignal): BootScene {
  const scene = new BootScene(signal);
  bootScenes.push(scene);
  return scene;
}

beforeEach(() => {
  art.add.mockReset();
  startup.prepare.mockResolvedValue(undefined);
  startup.probe.mockResolvedValue("current");
  vi.stubGlobal("window", { clearTimeout, location: { search: "" }, setTimeout });
});

it("loads an image separately unless the atlas provides its texture key", () => {
  for (const [atlas, loadsImage] of [
    [null, true],
    [{ textures: [] }, true],
    [{ textures: [{ key: "standalone-image" }] }, false],
  ] as const) {
    art.atlas = atlas;
    const scene = bootScene();
    // The loader watch wraps the multi-file methods it retries.
    const { bitmapFont } = scene.load;
    scene.preload();
    expect(scene.load.json).not.toHaveBeenCalledWith("manifest", expect.anything());
    expect(scene.cache.json.add).toHaveBeenCalledExactlyOnceWith("manifest", manifest);
    expect(bitmapFont).not.toHaveBeenCalled();
    if (loadsImage) {
      expect(scene.load.image).toHaveBeenCalledExactlyOnceWith(
        "standalone-image",
        "images/standalone.png",
      );
    } else {
      expect(scene.load.image).not.toHaveBeenCalled();
    }
  }
});

it("caches the data files the code bundles and loads the others", () => {
  const original = manifest.data;
  Object.assign(manifest, {
    data: [
      { json: "palette.json", key: "palette" },
      { json: "themes.json", key: "themes" },
    ],
  });
  try {
    const scene = bootScene();
    const { json } = scene.load;
    scene.preload();
    expect(scene.cache.json.add).toHaveBeenCalledWith("palette", BUNDLED_ART_DATA.palette);
    expect(json).toHaveBeenCalledExactlyOnceWith("themes", "themes.json");
  } finally {
    Object.assign(manifest, { data: original });
  }
});

// Every texture key preload queues, through each loader, in either mode, has a filter: a texture
// list added to the manifest, or a loader added here, fails this until it is classified.
it("classifies every texture it loads in development and atlas mode", () => {
  const lists = {
    backdrops: [{ key: "backdrop", png: "backdrops/backdrop.png" }],
    sprites: [{ json: "sprites/sprite.json", key: "sprite", once: [], png: "sprites/sprite.png" }],
    tilesets: [{ json: "tilesets/tileset.json", key: "tileset", png: "tilesets/tileset.png" }],
  };
  const original = { ...manifest };
  Object.assign(manifest, lists);
  for (const atlas of [
    null,
    { pages: [{ height: 1, url: "atlas-0.webp", width: 1 }], textures: [] },
  ]) {
    art.atlas = atlas;
    const scene = bootScene();
    const loaders = {
      aseprite: vi.fn(),
      bitmapFont: scene.load.bitmapFont,
      image: scene.load.image,
      spritesheet: vi.fn(),
    };
    Object.assign(scene.load, loaders);
    scene.preload();
    const loaded = [
      ...Object.values(loaders).flatMap((loader) =>
        vi.mocked(loader).mock.calls.map(([key]) => key as string),
      ),
      ...(atlas?.pages.map((_, page) => atlasPageKey(page)) ?? []),
    ];
    const filters = textureArt.textureFilters(manifest as unknown as ArtManifest, atlas);
    expect(loaded.length).toBeGreaterThan(0);
    expect(loaded.filter((key) => !filters.has(key))).toEqual([]);
    vi.clearAllMocks();
  }
  Object.assign(manifest, original);
});

// A file as the loader hands it to its events.
function loaderFile(key: string) {
  return { key, retryAttempts: 0, type: "image", url: `${key}.png`, xhrSettings: {} };
}

it("measures the boot load as waited, its share never moving back as files are added", () => {
  art.atlas = null;
  const scene = bootScene();
  scene.preload();
  const shares: number[] = [];
  const off = loadingProgress.subscribe(({ active, value }) => {
    if (active && value !== undefined) {
      shares.push(value);
    }
  });
  Object.assign(scene.load, { list: new Set([loaderFile("a"), loaderFile("b")]) });
  scene.load.emit("start");
  scene.load.emit("load", loaderFile("a"));
  scene.load.emit("addfile", "c", "image", scene.load, loaderFile("c"));
  scene.load.emit("load", loaderFile("b"));
  scene.load.emit("load", loaderFile("c"));
  scene.load.emit("complete");
  off();
  expect(shares.at(-1)).toBe(1);
  expect(shares).toContain(0.5);
  expect(shares.every((share, index) => index === 0 || share >= shares[index - 1]!)).toBe(true);
});

it("logs a failed boot file and queues it again in a later run that shows no bar", () => {
  vi.useFakeTimers();
  vi.stubGlobal("window", { clearTimeout, location: { search: "" }, setTimeout });
  art.atlas = null;
  const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  const scene = bootScene();
  scene.preload();
  Object.assign(scene.load, { list: new Set([loaderFile("a")]) });
  scene.load.emit("start");
  scene.load.emit("loaderror", loaderFile("a"));
  scene.load.emit("complete");
  expect(warn).toHaveBeenCalledExactlyOnceWith(
    "Loading a.png failed after 3 attempts; retrying later",
  );
  const measured: number[] = [];
  const off = loadingProgress.subscribe(({ value }) => {
    if (value !== undefined) {
      measured.push(value);
    }
  });
  vi.mocked(scene.load.image).mockClear();
  vi.advanceTimersByTime(15000);
  expect(scene.load.image).toHaveBeenCalledExactlyOnceWith("a", "a.png");
  expect(scene.load.start).toHaveBeenCalledOnce();
  scene.load.emit("start");
  scene.load.emit("load", loaderFile("a"));
  scene.load.emit("complete");
  off();
  expect(measured).toEqual([]);
  warn.mockRestore();
  vi.useRealTimers();
});

afterEach(() => {
  bootScenes.splice(0).forEach((scene) => scene.events.emit("shutdown"));
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it.each([
  ["", "start"],
  ["?zone=street", "zone"],
])("requires UI readiness before reading progress and routing %s to %s", async (search, target) => {
  art.atlas = null;
  vi.stubGlobal("window", { location: { search } });
  let loaded!: (age: "current") => void;
  startup.load.mockReturnValue(
    new Promise<"current">((resolve) => {
      loaded = resolve;
    }),
  );
  const scene = bootScene();
  let prepared!: () => void;
  startup.prepare.mockReturnValue(
    new Promise<void>((resolve) => {
      prepared = resolve;
    }),
  );
  scene.create();
  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
  expect(startup.load).not.toHaveBeenCalled();
  prepared();
  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
  expect(startup.load).toHaveBeenCalledExactlyOnceWith();
  expect(scene.scene.start).not.toHaveBeenCalled();
  loaded("current");
  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
  expect((scene.scene.launch as ReturnType<typeof vi.fn>).mock.calls).toEqual([
    ["pause"],
    ["achievementNotice"],
  ]);
  expect(scene.scene.start).toHaveBeenCalledExactlyOnceWith(target);
});

it("keeps stage previews independent of startup and saved progress", () => {
  art.atlas = null;
  vi.stubGlobal("window", { location: { search: "?stagePreview=street" } });
  const scene = bootScene();
  scene.create();
  expect(scene.scene.start).toHaveBeenCalledExactlyOnceWith("zone");
  expect(startup.load).not.toHaveBeenCalled();
});

// Boot with a save a newer version wrote, the game loop's sleep recorded.
async function bootNewer() {
  art.atlas = null;
  vi.stubGlobal("window", { location: { search: "" } });
  vi.stubGlobal("document", {});
  startup.probe.mockResolvedValue("newer");
  startup.load.mockResolvedValue("newer");
  const scene = bootScene();
  const sleep = vi.fn();
  Object.assign(scene.game.loop, { sleep });
  scene.create();
  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
  return { scene, sleep };
}

it("updates by itself for a newer save, idle, and never opens Start or the pause scene", async () => {
  const { scene, sleep } = await bootNewer();
  expect(startup.requireNewer).toHaveBeenCalledOnce();
  expect(sleep).toHaveBeenCalledOnce();
  expect(scene.scene.start).not.toHaveBeenCalled();
  expect(scene.scene.launch).not.toHaveBeenCalled();
});

it("shows the travelling loading bar while the forced update downloads", async () => {
  await bootNewer();
  const states: (number | undefined)[] = [];
  backgroundProgress.subscribe(({ active, value }) => states.push(active ? value : -1));
  requiredUpdate.report("updating");
  expect(states.at(-1)).toBeUndefined();
  expect(startup.mount).not.toHaveBeenCalled();
});

it("shows the connect message when no newer version can be downloaded, until one can", async () => {
  await bootNewer();
  const unmount = vi.fn();
  startup.mount.mockReturnValue(unmount);
  requiredUpdate.report("unavailable");
  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
  expect(startup.mount).toHaveBeenCalledExactlyOnceWith(expect.any(BootScene), {
    id: "connect-card",
    text: TEXT.update.connect,
  });
  requiredUpdate.report("updating");
  expect(unmount).toHaveBeenCalledOnce();
});

it("keeps failed required UI before all save mutation and retries its own entry once", async () => {
  const { requiredLoading } = await import("../../loading/required.ts");
  art.atlas = null;
  startup.prepare.mockRejectedValueOnce(new Error("Required font failed"));
  startup.load.mockResolvedValue("current");
  const scene = bootScene();
  scene.create();
  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
  expect(requiredLoading.state.kind).toBe("failed");
  expect(startup.load).not.toHaveBeenCalled();
  expect(scene.scene.start).not.toHaveBeenCalled();
  await requiredLoading.retry();
  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
  expect(startup.prepare).toHaveBeenCalledTimes(2);
  expect(startup.load).toHaveBeenCalledOnce();
  expect(scene.scene.start).toHaveBeenCalledExactlyOnceWith("start");
});

it("retries only a failed required atlas page before art initialization or save entry", async () => {
  const { requiredLoading } = await import("../../loading/required.ts");
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  vi.stubGlobal("window", { clearTimeout, location: { search: "" }, setTimeout });
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const filter = vi.spyOn(textureArt, "filterLoadedArt");
  const required = loaderFile(atlasPageKey(0));
  const optional = loaderFile(atlasPageKey(1));
  art.atlas = {
    pages: [
      { height: 1, url: required.url, width: 1 },
      { height: 1, url: optional.url, width: 1 },
    ],
    textures: [...new Set(UI_FRAMES.map(({ art }) => art))].map((key) => ({
      frames: [],
      key,
      page: 0,
    })),
  };
  startup.load.mockResolvedValue("current");
  const scene = bootScene();
  scene.preload();
  Object.assign(scene.load, { list: new Set([required, optional]) });
  scene.load.emit("start");
  scene.load.emit("loaderror", required);
  scene.load.emit("loaderror", optional);
  scene.load.emit("complete");
  scene.create();
  const settle = () =>
    new Promise<void>((resolve) => {
      setImmediate(resolve);
    });
  await settle();
  const noEntry = () => {
    expect(requiredLoading.state.kind).toBe("failed");
    expect(art.add).not.toHaveBeenCalled();
    expect(filter).not.toHaveBeenCalled();
    expect(scene.anims.create).not.toHaveBeenCalled();
    expect(startup.prepare).not.toHaveBeenCalled();
    expect(startup.load).not.toHaveBeenCalled();
    expect(scene.scene.start).not.toHaveBeenCalled();
  };
  noEntry();
  expect(scene.load.start).not.toHaveBeenCalled();
  vi.mocked(scene.load.image).mockClear();
  vi.advanceTimersByTime(15000);
  expect(scene.load.image).toHaveBeenCalledExactlyOnceWith(optional.key, optional.url);
  scene.load.emit("start");
  scene.load.emit("loaderror", optional);
  scene.load.emit("complete");
  noEntry();
  vi.mocked(scene.load.image).mockClear();
  const failedRetry = requiredLoading.retry();
  await settle();
  expect(scene.load.image).toHaveBeenCalledExactlyOnceWith(required.key, required.url);
  scene.load.emit("start");
  scene.load.emit("loaderror", required);
  scene.load.emit("complete");
  await failedRetry;
  noEntry();
  const successfulRetry = requiredLoading.retry();
  await settle();
  expect(vi.mocked(scene.load.image).mock.calls).toEqual([
    [required.key, required.url],
    [required.key, required.url],
  ]);
  vi.mocked(scene.textures.exists).mockImplementation((key) => key === required.key);
  scene.load.emit("start");
  scene.load.emit("load", required);
  scene.load.emit("complete");
  await successfulRetry;
  await settle();
  expect(requiredLoading.state.kind).toBe("ready");
  expect(filter).toHaveBeenCalledOnce();
  expect(startup.prepare).toHaveBeenCalledOnce();
  expect(startup.load).toHaveBeenCalledOnce();
  expect(scene.scene.start).toHaveBeenCalledExactlyOnceWith("start");
});

it("does not enter from an obsolete required UI completion after Boot shuts down", async () => {
  art.atlas = null;
  let prepared!: () => void;
  startup.prepare.mockReturnValue(
    new Promise<void>((resolve) => {
      prepared = resolve;
    }),
  );
  const scene = bootScene();
  scene.create();
  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
  scene.events.emit("shutdown");
  prepared();
  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
  expect(startup.load).not.toHaveBeenCalled();
  expect(scene.scene.start).not.toHaveBeenCalled();
});

it("retains owned UI aliases through a font retry and creates remaining world aliases once", async () => {
  const { addAtlasArt } = await vi.importActual<typeof import("./atlasArt.ts")>("./atlasArt.ts");
  const { requiredLoading } = await import("../../loading/required.ts");
  art.add.mockImplementation(addAtlasArt);
  const keys = [...new Set(UI_FRAMES.map(({ art }) => art))];
  const atlas: AtlasManifest = {
    pages: [{ height: 32, url: "atlas.webp", width: 32 }],
    textures: [...keys, "world-texture"].map((key) => ({
      frames: [{ h: 7, name: "__BASE", w: 9, x: 2, y: 3 }],
      key,
      page: 0,
    })),
  };
  art.atlas = atlas;
  startup.prepare.mockRejectedValueOnce(new Error("Required font failed"));
  startup.load.mockResolvedValue("current");
  const scene = bootScene();
  const page = scene.textures.createCanvas(atlasPageKey(0), 32, 32)!;
  const setFilter = vi.fn();
  Object.assign(page.source[0]!, { setFilter });
  const created: string[] = [];
  Object.assign(scene.textures, {
    create(key: string) {
      if (scene.textures.exists(key)) {
        throw new Error(`Duplicate texture alias ${key}`);
      }
      const alias = scene.textures.createCanvas(key, 1, 1)!;
      alias.source.length = 0;
      created.push(key);
      return alias;
    },
  });
  scene.create();
  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
  expect(requiredLoading.state.kind).toBe("failed");
  expect(created).toEqual(keys);
  expect(startup.load).not.toHaveBeenCalled();
  await requiredLoading.retry();
  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
  expect(requiredLoading.state.kind).toBe("ready");
  expect(created).toEqual([...keys, "world-texture"]);
  for (const key of created) {
    expect(scene.textures.get(key).source).toEqual([page.source[0]]);
    expect(scene.textures.getFrame(key)).toMatchObject({
      cutHeight: 7,
      cutWidth: 9,
      cutX: 2,
      cutY: 3,
    });
  }
  expect(startup.prepare).toHaveBeenCalledTimes(2);
  expect(setFilter).toHaveBeenCalledExactlyOnceWith(1);
  expect(startup.load).toHaveBeenCalledOnce();
  expect(scene.scene.start).toHaveBeenCalledExactlyOnceWith("start");
});

it("preserves confirmed-newer automatic recovery and Connect even when current UI fails", async () => {
  const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
  startup.prepare.mockRejectedValue(new AggregateError([new Error("font"), new Error("skin")]));
  // bootNewer sets the probe, so override readiness after its fixture reset only here.
  const { scene, sleep } = await bootNewer();
  expect(sleep).toHaveBeenCalledOnce();
  expect(startup.requireNewer).toHaveBeenCalledOnce();
  expect(startup.prepare).toHaveBeenCalledExactlyOnceWith(scene, { required: false });
  requiredUpdate.report("unavailable");
  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
  expect(startup.mount).toHaveBeenCalledWith(
    scene,
    expect.objectContaining({ text: TEXT.update.connect }),
  );
  expect(startup.load).not.toHaveBeenCalled();
  expect(scene.scene.start).not.toHaveBeenCalled();
  expect(scene.scene.launch).not.toHaveBeenCalled();
  warning.mockRestore();
});

it("quiesces an aborted partial Game before its pending save probe can start Boot work", async () => {
  art.atlas = null;
  let probed!: (age: "current") => void;
  startup.probe.mockReturnValue(
    new Promise<"current">((resolve) => {
      probed = resolve;
    }),
  );
  const startupAbort = new AbortController();
  const scene = bootScene(startupAbort.signal);
  scene.create();
  startupAbort.abort();
  probed("current");
  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
  expect(startup.prepare).not.toHaveBeenCalled();
  expect(startup.load).not.toHaveBeenCalled();
  expect(scene.scene.start).not.toHaveBeenCalled();
  // A later native loader completion cannot restart a cancelled startup.
  scene.create();
  expect(startup.probe).toHaveBeenCalledOnce();
});
