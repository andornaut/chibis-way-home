import { EventEmitter } from "node:events";

import { afterEach, expect, it, vi } from "vitest";

const startup = vi.hoisted(() => ({ load: vi.fn(), ready: vi.fn() }));
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
vi.mock("phaser", () => ({
  Scene: class {
    readonly anims = { create: vi.fn() };
    readonly scene = { launch: vi.fn(), start: vi.fn() };
    readonly game = { canvas: { style: { visibility: "" } }, events: new EventEmitter() };
    readonly cache = { json: { add: vi.fn(), get: vi.fn() } };
    readonly textures = { get: vi.fn(() => ({ source: [] })) };
    readonly load = Object.assign(new EventEmitter(), {
      bitmapFont: vi.fn(),
      image: vi.fn(),
      json: vi.fn(),
      setPath: vi.fn(),
    });
  },
}));
vi.mock("../pwa", () => ({ launchReady: startup.ready }));
vi.mock("./save", () => ({ loadProgress: startup.load }));
vi.mock("./atlasArt", () => ({
  get ATLAS() {
    return art.atlas;
  },
  queueAtlasPages: vi.fn(),
}));

import { BootScene } from "./BootScene";

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

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it.each([
  ["", "start"],
  ["?zone=street", "zone"],
])("waits for version readiness and progress before routing %s to %s", async (search, target) => {
  art.atlas = null;
  vi.stubGlobal("window", { location: { search } });
  let ready!: () => void;
  let loaded!: () => void;
  startup.ready.mockReturnValue(
    new Promise<void>((resolve) => {
      ready = resolve;
    }),
  );
  startup.load.mockReturnValue(
    new Promise<void>((resolve) => {
      loaded = resolve;
    }),
  );
  const scene = new BootScene();
  scene.create();
  expect(startup.load).not.toHaveBeenCalled();
  expect(scene.scene.start).not.toHaveBeenCalled();
  ready();
  await Promise.resolve();
  expect(startup.load).toHaveBeenCalledExactlyOnceWith(undefined);
  expect(scene.scene.start).not.toHaveBeenCalled();
  loaded();
  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
  expect(scene.scene.launch).toHaveBeenCalledExactlyOnceWith("pause");
  expect(scene.scene.start).toHaveBeenCalledExactlyOnceWith(target);
});

it("keeps stage previews independent of startup and saved progress", () => {
  art.atlas = null;
  vi.stubGlobal("window", { location: { search: "?stagePreview=street" } });
  const scene = new BootScene();
  scene.create();
  expect(scene.scene.start).toHaveBeenCalledExactlyOnceWith("zone");
  expect(startup.ready).not.toHaveBeenCalled();
  expect(startup.load).not.toHaveBeenCalled();
});
