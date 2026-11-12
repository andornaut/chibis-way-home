import { afterEach, expect, it, vi } from "vitest";

const startup = vi.hoisted(() => ({ load: vi.fn() }));
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
vi.mock("./atlasArt", () => ({
  get ATLAS() {
    return art.atlas;
  },
  queueAtlasPages: vi.fn(),
}));

import { type ArtManifest, atlasPageKey } from "../assets";
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
  let loaded!: () => void;
  startup.load.mockReturnValue(
    new Promise<void>((resolve) => {
      loaded = resolve;
    }),
  );
  const scene = new BootScene();
  scene.create();
  expect(startup.load).toHaveBeenCalledExactlyOnceWith();
  await Promise.resolve();
  expect(scene.scene.start).not.toHaveBeenCalled();
  loaded();
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
