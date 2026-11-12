import { afterEach, expect, it, vi } from "vitest";

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
    Scene: class {
      constructor() {
        Object.assign(this, sceneStub(vi.fn));
      }
    },
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
import { loadingProgress } from "../loading/progress";
import { requiredUpdate } from "../pwa";
import { BootScene } from "./BootScene";
import { textureFilters } from "./textureFilters";

it("loads standalone manifest images in development and atlas mode", () => {
  for (const atlas of [null, {}]) {
    art.atlas = atlas;
    const scene = new BootScene();
    scene.preload();
    expect(scene.load.json).not.toHaveBeenCalledWith("manifest", expect.anything());
    expect(scene.cache.json.add).toHaveBeenCalledExactlyOnceWith("manifest", manifest);
    expect(scene.load.bitmapFont).toHaveBeenCalledExactlyOnceWith(
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

it("names the key and URL of an asset that fails to load", () => {
  art.atlas = null;
  const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  const scene = new BootScene();
  scene.preload();
  scene.load.emit("loaderror", { key: "standalone-image", url: "art/images/standalone.png" });
  expect(warn).toHaveBeenCalledExactlyOnceWith(
    "Asset failed to load: standalone-image (art/images/standalone.png)",
  );
  warn.mockRestore();
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
  loadingProgress.subscribe(({ active, value }) => states.push(active ? value : -1));
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
