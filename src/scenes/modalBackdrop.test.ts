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
// The whole canvas, 900x500 base pixels at two device pixels each.
const CANVAS = { height: 500, width: 900, x: 0, y: 0 };
const BACKING = { height: 1000, width: 1800, x: 0, y: 0 };
vi.mock("./playCamera", () => ({
  canvasRect: () => CANVAS,
  fitCanvasCamera: vi.fn(),
}));

import { showModalBackdrop } from "./modalBackdrop";
import { modalInput } from "./modalInput";

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
    const image = { setDisplaySize: vi.fn() };
    scene.events.emit("addedtoscene", image);
    expect(card.ignore).toHaveBeenCalledWith(image);
    expect(image.setDisplaySize).toHaveBeenCalledWith(CANVAS.width, CANVAS.height);
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
});
