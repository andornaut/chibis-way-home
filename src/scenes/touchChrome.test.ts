import {
  animationKey,
  type AsepriteSheet,
  sheetTags,
  tagRepeat,
} from "@andornaut/game-kit/art/aseprite";
import { sceneStub } from "@andornaut/game-kit/testing/phaser/sceneStub";
import { type Scene, Textures } from "phaser";
import { expect, it, vi } from "vitest";

import manifest from "../../public/art/manifest.json";
import palette from "../../public/art/palette.json";
import move from "../../public/art/sprites/ui-move-hint.json";
import knob from "../../public/art/sprites/ui-move-knob.json";
import jump from "../../public/art/sprites/ui-touch-jump.json";
import use from "../../public/art/sprites/ui-touch-use.json";
import { chromeCanvasTexture } from "../testing/chromeTexture";
import { deviceScale, fitScale } from "../testing/renderScale";
import { createTouchChrome } from "./touchChrome";

vi.mock("phaser", () => ({
  Core: { Events: { POST_STEP: "poststep" } },
  Textures: { FilterMode: { NEAREST: 0 } },
}));
vi.mock("./cardParts", () => ({
  paletteColour: (_scene: unknown, name: keyof typeof palette.colours) =>
    parseInt(palette.colours[name].slice(1), 16),
}));

it("caches four isolated nearest-sampled sheets and retains authored frame order, durations and repeat flags", () => {
  const data: Record<string, unknown> = {
    manifest,
    "ui-move-hint": move,
    "ui-move-knob": knob,
    "ui-touch-jump": jump,
    "ui-touch-use": use,
  };
  const textures: ReturnType<typeof chromeCanvasTexture>[] = [];
  const createCanvas = vi.fn((key: string, width: number, height: number) => {
    const texture = chromeCanvasTexture(key, width, height);
    textures.push(texture);
    Object.assign(stub.textures.list, { [key]: texture });
    return texture;
  });
  const sprite = vi.fn(() => ({
    setAlpha: vi.fn().mockReturnThis(),
    setDisplaySize: vi.fn().mockReturnThis(),
    setOrigin: vi.fn().mockReturnThis(),
  }));
  // Four screen pixels per base pixel.
  const stub = sceneStub(vi.fn, { add: { sprite }, scale: fitScale(4) });
  for (const [key, sheet] of Object.entries(data)) {
    stub.cache.json.add(key, sheet);
  }
  Object.assign(stub.textures, { createCanvas });
  const scene = stub as unknown as Scene;
  for (const kind of ["jump", "use", "move", "knob"] as const) {
    const source =
      kind === "move" ? "ui-move-hint" : kind === "knob" ? "ui-move-knob" : `ui-touch-${kind}`;
    createTouchChrome(scene, kind);
    createTouchChrome(scene, kind);
    expect(sprite.mock.results.at(-1)!.value.setAlpha).toHaveBeenCalledExactlyOnceWith(0.85);
    expect(sprite.mock.results.at(-1)!.value.setDisplaySize).toHaveBeenCalledWith(
      kind === "knob" ? 11 : 75,
      kind === "knob" ? 11 : 75,
    );
    for (const [tag, frames] of sheetTags(data[source] as AsepriteSheet)) {
      expect(stub.anims.create).toHaveBeenCalledWith({
        frames: frames.map(({ duration, frame }) => ({
          duration,
          frame,
          key: `touch-chrome-${kind}`,
        })),
        key: animationKey(`touch-chrome-${kind}`, tag),
        repeat: tagRepeat(manifest.sprites.find((entry) => entry.key === source)!.once, tag),
      });
    }
  }
  expect(createCanvas).toHaveBeenCalledTimes(4);
  for (const texture of textures) {
    expect(texture.setFilter).toHaveBeenCalledExactlyOnceWith(Textures.FilterMode.NEAREST);
    expect(
      texture.add.mock.calls.every((call) => call[4] === call[5] && [300, 44].includes(call[4])),
    ).toBe(true);
  }
});

it("paints one texel per screen pixel and repaints when the display scale or pixel ratio changes", () => {
  vi.stubGlobal("devicePixelRatio", 3);
  const textures: ReturnType<typeof chromeCanvasTexture>[] = [];
  const createCanvas = vi.fn((key: string, width: number, height: number) => {
    const texture = chromeCanvasTexture(key, width, height);
    textures.push(texture);
    Object.assign(stub.textures.list, { [key]: texture });
    return texture;
  });
  const sprite = vi.fn(() => {
    const object = {
      scaleX: 0,
      scaleY: 0,
      setAlpha: vi.fn().mockReturnThis(),
      setDisplaySize: vi.fn((width: number, height: number) =>
        Object.assign(object, { scaleX: width / 1000, scaleY: height / 1000 }),
      ),
      setOrigin: vi.fn().mockReturnThis(),
      setScale: vi.fn((x: number, y: number) => Object.assign(object, { scaleX: x, scaleY: y })),
      setSizeToFrame: vi.fn(),
      texture: undefined as unknown,
    };
    return object;
  });
  // An 844x390 landscape phone, its backing capped at two device pixels per CSS pixel: the view
  // fits at 390 / 360 CSS pixels per base pixel.
  const phone = { height: 390, width: 844 };
  const stub = sceneStub(vi.fn, { add: { sprite }, scale: deviceScale(phone, 2) });
  stub.cache.json.add("manifest", manifest).add("ui-touch-jump", jump);
  Object.assign(stub.textures, { createCanvas });
  Object.assign(stub.game, { scene: { scenes: [stub] } });
  const scene = stub as unknown as Scene;
  const control = createTouchChrome(scene, "jump") as unknown as ReturnType<typeof sprite>;
  const [texture] = textures;
  control.texture = texture;
  stub.children.list.push(control as never);
  const frames = [...texture!.frames.values()];
  // 75 base pixels at 390 / 360 * 3 screen pixels each: the full device pixel ratio, not the
  // backing's capped one.
  expect(frames.map((frame) => frame.cutWidth)).toEqual(frames.map(() => 244));
  stub.game.events.emit("poststep");
  expect(texture!.setSize).toHaveBeenCalledTimes(1);

  vi.stubGlobal("devicePixelRatio", 1);
  Object.assign(stub.scale, deviceScale(phone));
  stub.game.events.emit("poststep");
  expect(texture!.setSize).toHaveBeenLastCalledWith(83 * frames.length, 83);
  expect(frames.map((frame) => frame.cutWidth)).toEqual(frames.map(() => 81));
  expect(control.scaleX).toBeCloseTo((0.075 * 244) / 81);

  Object.assign(stub.scale, fitScale(2));
  stub.game.events.emit("poststep");
  expect(frames.map((frame) => frame.cutWidth)).toEqual(frames.map(() => 150));
  expect(control.scaleX * 150).toBeCloseTo(0.075 * 244);
  expect(control.setSizeToFrame).toHaveBeenCalledTimes(2);
  expect(texture!.refresh).toHaveBeenCalledTimes(3);
  vi.unstubAllGlobals();
});
