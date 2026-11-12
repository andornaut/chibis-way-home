import { afterEach, beforeEach, expect, it, vi } from "vitest";

const startup = vi.hoisted(() => ({ load: vi.fn(), mount: vi.fn(), requireNewer: vi.fn() }));
const art = vi.hoisted(() => ({ atlas: null as null | object }));
const manifest = vi.hoisted(() => ({
  backdrops: [],
  data: [],
  fonts: [{ fnt: "fonts/body.fnt", key: "font-body", png: "fonts/body.png" }],
  images: [{ key: "standalone-image", png: "images/standalone.png" }],
  sprites: [],
  tilesets: [],
}));
vi.mock("../../public/art/manifest.json", () => ({ default: manifest }));
vi.mock("phaser", async () => {
  const { sceneStub } = await import("@andornaut/game-kit/testing/phaser/sceneStub");
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
vi.mock("./save", () => ({ loadProgress: startup.load }));
vi.mock("../pwa", async () => {
  const { createRequiredUpdate } = await import("../pwa/requiredUpdate");
  return { requireNewer: startup.requireNewer, requiredUpdate: createRequiredUpdate() };
});
vi.mock("./domUi", () => ({
  mountSceneView: startup.mount,
  prepareDomUi: () => Promise.resolve(),
}));
vi.mock("../ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../ui")>()),
  createMessageCard: (document: unknown, id: string, text: string) => ({ id, text }),
}));
vi.mock("./atlasArt", () => ({
  get ATLAS() {
    return art.atlas;
  },
  queueAtlasPages: vi.fn(),
}));

import { type ArtManifest, atlasPageKey } from "../assets";
import { TEXT } from "../data/text";
import { backgroundProgress, loadingProgress } from "../loading/progress";
import { requiredUpdate } from "../pwa";
import { BootScene } from "./BootScene";
import { textureFilters } from "./textureFilters";

beforeEach(() => {
  vi.stubGlobal("window", { clearTimeout, location: { search: "" }, setTimeout });
});

it("loads standalone manifest images in development and atlas mode", () => {
  for (const atlas of [null, {}]) {
    art.atlas = atlas;
    const scene = new BootScene();
    // The loader watch wraps the multi-file methods it retries.
    const { bitmapFont } = scene.load;
    scene.preload();
    expect(scene.load.json).not.toHaveBeenCalledWith("manifest", expect.anything());
    expect(scene.cache.json.add).toHaveBeenCalledExactlyOnceWith("manifest", manifest);
    expect(bitmapFont).toHaveBeenCalledExactlyOnceWith(
      "font-body",
      "fonts/body.png",
      "fonts/body.fnt",
    );
    expect(scene.load.image).toHaveBeenCalledExactlyOnceWith(
      "standalone-image",
      "images/standalone.png",
    );
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
    const scene = new BootScene();
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
    const filters = textureFilters(manifest as unknown as ArtManifest, atlas);
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
  const scene = new BootScene();
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
  const scene = new BootScene();
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

it("queues a failed boot font again whole in a later run", () => {
  vi.useFakeTimers();
  vi.stubGlobal("window", { clearTimeout, location: { search: "" }, setTimeout });
  art.atlas = null;
  const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  const scene = new BootScene();
  const { bitmapFont } = scene.load;
  // Each call queues the font's image and data as Phaser's multi-file load does.
  const font = { key: "font-body" };
  const files = [
    { ...loaderFile("font-body"), multiFile: font, url: "fonts/body.png" },
    { ...loaderFile("font-body"), multiFile: font, type: "xml", url: "fonts/body.fnt" },
  ];
  vi.mocked(bitmapFont).mockImplementation(() => {
    for (const file of files) {
      scene.load.emit("addfile", file.key, file.type, scene.load, file);
    }
    return scene.load;
  });
  scene.preload();
  Object.assign(scene.load, { list: new Set(files) });
  scene.load.emit("start");
  scene.load.emit("loaderror", files[0]);
  scene.load.emit("load", files[1]);
  scene.load.emit("complete");
  expect(warn).toHaveBeenCalledExactlyOnceWith(
    "Loading fonts/body.png failed after 3 attempts; retrying later",
  );
  vi.mocked(bitmapFont).mockClear();
  vi.advanceTimersByTime(15000);
  expect(bitmapFont).toHaveBeenCalledExactlyOnceWith(
    "font-body",
    "fonts/body.png",
    "fonts/body.fnt",
  );
  expect(scene.load.start).toHaveBeenCalledOnce();
  warn.mockRestore();
  vi.useRealTimers();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it.each([
  ["", "start"],
  ["?zone=street", "zone"],
])("reads progress at once before routing %s to %s", async (search, target) => {
  art.atlas = null;
  vi.stubGlobal("window", { location: { search } });
  let loaded!: (age: "current") => void;
  startup.load.mockReturnValue(
    new Promise<"current">((resolve) => {
      loaded = resolve;
    }),
  );
  const scene = new BootScene();
  scene.create();
  expect(startup.load).toHaveBeenCalledExactlyOnceWith();
  await Promise.resolve();
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
  const scene = new BootScene();
  scene.create();
  expect(scene.scene.start).toHaveBeenCalledExactlyOnceWith("zone");
  expect(startup.load).not.toHaveBeenCalled();
});

// Boot with a save a newer version wrote, the game loop's sleep recorded.
async function bootNewer() {
  art.atlas = null;
  vi.stubGlobal("window", { location: { search: "" } });
  vi.stubGlobal("document", {});
  startup.load.mockResolvedValue("newer");
  const scene = new BootScene();
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
