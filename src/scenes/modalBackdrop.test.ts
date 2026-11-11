import { EventEmitter } from "node:events";

import type { Scene } from "phaser";
import { describe, expect, it, vi } from "vitest";

import paletteData from "../../public/art/palette.json";

const capture = vi.hoisted(() => ({ mount: vi.fn() }));
vi.mock("@andornaut/game-kit/view/phaser/modalBackdrop", () => ({
  mountModalBackdrop: capture.mount,
}));
vi.mock("phaser", () => ({ Scenes: { Events: { ADDED_TO_SCENE: "addedtoscene" } } }));
vi.mock("./cardParts", () => ({
  palette: () => paletteData,
  paletteColour: () => 0x181425,
}));
// The backing at two device pixels per CSS pixel: an 844x358 play area.
const BACKING = { height: 716, width: 1688, x: 0, y: 0 };
vi.mock("./playCamera", async (original) => ({
  ...(await original<typeof import("./playCamera")>()),
  fitCanvasCamera: vi.fn(),
}));

import type { Size } from "../data/types";
import { canvasSize, viewShift } from "../ui";
import { showModalBackdrop } from "./modalBackdrop";
import { modalInput } from "./modalInput";
import { canvasRect, sceneFit } from "./playCamera";

function fixture() {
  const camera = () => ({
    ignore: vi.fn(),
    setVisible(value: boolean) {
      this.visible = value;
      return this;
    },
    visible: true,
  });
  const card = camera();
  const background = camera();
  const cameras = [card];
  const scene = {
    cameras: {
      add: () => {
        cameras.push(background);
        return background;
      },
      cameras,
      remove: vi.fn(),
    },
    children: { list: [{}] },
    events: new EventEmitter(),
    game: {},
    scale: Object.assign(new EventEmitter(), {
      gameSize: { height: BACKING.height, width: BACKING.width },
      zoom: 1 / 2,
    }),
  } as unknown as Scene;
  let resolve!: (value: boolean) => void;
  const destroy = vi.fn();
  capture.mount.mockReturnValue({
    destroy,
    ready: new Promise<boolean>((done) => {
      resolve = done;
    }),
  });
  return { background, card, destroy, resolve, scene };
}

// A backdrop object that records where it is placed, frame the size of its texture in pixels.
function placed(type: string, frame: Size) {
  const object = {
    ...frame,
    displayHeight: frame.height,
    displayWidth: frame.width,
    setDisplaySize: vi.fn((width: number, height: number) => {
      object.displayWidth = width;
      object.displayHeight = height;
      return object;
    }),
    setPosition: vi.fn((x: number, y: number) => {
      object.x = x;
      object.y = y;
      return object;
    }),
    type,
    x: 0,
    y: 0,
  };
  return object;
}

describe("Duck modal backdrop adapter", () => {
  it("dims an unshaded frozen capture once, hiding cards until ready and separating backdrop art", async () => {
    const { background, card, resolve, scene } = fixture();
    const modal = showModalBackdrop(scene);
    expect(card.visible).toBe(false);
    const context = capture.mount.mock.calls.at(-1)?.[0] as { remap(colour: number): number };
    expect(context.remap(Number.parseInt(paletteData.colours.white.slice(1), 16))).toBe(
      Number.parseInt(paletteData.colours.slate.slice(1), 16),
    );
    expect(modalInput(scene).accepts()).toBe(false);
    expect(scene.cameras.cameras[0]).toBe(background);
    expect(capture.mount.mock.calls.at(-1)?.[1]).toEqual(BACKING);
    const fill = placed("Rectangle", { height: 1, width: 1 });
    scene.events.emit("addedtoscene", fill);
    expect(card.ignore).toHaveBeenCalledWith(fill);
    const canvas = canvasRect(scene);
    expect(fill.setDisplaySize).toHaveBeenCalledWith(canvas.width, canvas.height);
    resolve(false);
    await modal.ready;
    expect(card.visible).toBe(true);
    expect(background.visible).toBe(true);
    expect(modalInput(scene).accepts()).toBe(true);
    const focusRing = {};
    scene.events.emit("addedtoscene", focusRing);
    expect(background.ignore).toHaveBeenCalledWith(focusRing);
  });

  it("never restores card cameras after shutdown during a pending capture", async () => {
    const { card, destroy, resolve, scene } = fixture();
    const modal = showModalBackdrop(scene, true);
    const context = capture.mount.mock.calls.at(-1)?.[0] as { remap(colour: number): number };
    expect(context.remap(0x123456)).toBe(0x123456);
    scene.events.emit("shutdown");
    resolve(false);
    await modal.ready;
    expect(card.visible).toBe(false);
    expect(destroy).toHaveBeenCalledOnce();
  });

  it("keeps a capture's shape and its view over the live view when a refit reshapes the canvas", () => {
    const { scene } = fixture();
    showModalBackdrop(scene);
    const captured = { height: BACKING.height, width: BACKING.width };
    const before = viewShift(sceneFit(scene));
    const size = canvasSize(sceneFit(scene));
    const image = placed("Image", captured);
    scene.events.emit("addedtoscene", image);
    expect([image.x, image.y, image.displayWidth, image.displayHeight]).toEqual([
      0,
      0,
      size.width,
      size.height,
    ]);
    // The play area narrows to 750x358 CSS pixels: the canvas is a different shape.
    Object.assign(scene.scale.gameSize, { height: 716, width: 1500 });
    scene.scale.emit("resize");
    expect(image.displayWidth / captured.width).toBeCloseTo(
      image.displayHeight / captured.height,
      9,
    );
    const after = viewShift(sceneFit(scene));
    expect(image.x + before.x).toBeCloseTo(after.x, 9);
    expect(image.y + before.y).toBeCloseTo(after.y, 9);
  });
});
