import { animationKey } from "@andornaut/game-kit/art/aseprite";
import type { Scene } from "phaser";
import { expect, it, vi } from "vitest";

import { createPulseSpanArt } from "./pulseSpanArt.ts";

function item() {
  const state = {
    alpha: 1,
    anim: undefined as string | undefined,
    depth: 0,
    flipX: false,
    height: 0,
    paused: false,
    visible: true,
    width: 0,
    x: 0,
    y: 0,
  };
  const object = {
    anims: {
      get currentAnim() {
        return state.anim === undefined ? undefined : { key: state.anim };
      },
      pause: vi.fn(() => {
        state.paused = true;
      }),
    },
    destroy: vi.fn(),
    play: vi.fn((key: string) => {
      state.anim = key;
      return object;
    }),
    setAlpha: vi.fn((alpha: number) => {
      state.alpha = alpha;
      return object;
    }),
    setDepth: vi.fn((depth: number) => {
      state.depth = depth;
      return object;
    }),
    setFlipX: vi.fn((flipX: boolean) => {
      state.flipX = flipX;
      return object;
    }),
    setOrigin: vi.fn(() => object),
    setPosition: vi.fn((x: number, y: number) => {
      Object.assign(state, { x, y });
      return object;
    }),
    setSize: vi.fn((width: number, height: number) => {
      Object.assign(state, { height, width });
      return object;
    }),
    setVisible: vi.fn((visible: boolean) => {
      state.visible = visible;
      return object;
    }),
    state,
  };
  return object;
}

function scene() {
  const sprites: ReturnType<typeof item>[] = [];
  const rectangles: ReturnType<typeof item>[] = [];
  const add = {
    rectangle: vi.fn(() => {
      const made = item();
      rectangles.push(made);
      return made;
    }),
    sprite: vi.fn(() => {
      const made = item();
      sprites.push(made);
      return made;
    }),
  };
  return { rectangles, scene: { add } as unknown as Scene, sprites };
}

const VOLUME = { height: 48, width: 144, x: 100, y: 200 };
const STREAM = { height: 48, key: "woodland-gust-stream", width: 48 };

it("repeats the stream's tag across the volume, mirrored when it blows left, once the sprite exists", () => {
  const { rectangles, scene: host, sprites } = scene();
  const art = createPulseSpanArt(3, STREAM, 0, host);
  art.draw(VOLUME, -1, "pulse");
  expect(rectangles).toEqual([]);
  expect(sprites.map(({ state }) => [state.anim, state.x, state.y, state.flipX])).toEqual([
    [animationKey(STREAM.key, "pulse"), 196, 200, true],
    [animationKey(STREAM.key, "pulse"), 148, 200, true],
    [animationKey(STREAM.key, "pulse"), 100, 200, true],
  ]);
  expect(sprites.every(({ state }) => state.depth === 3)).toBe(true);
  // A redraw reuses the copies and keeps their animations running.
  art.draw(VOLUME, -1, "pulse");
  expect(sprites).toHaveLength(3);
  expect(sprites.every(({ play }) => play.mock.calls.length === 1)).toBe(true);
  art.pause();
  expect(sprites.every(({ state }) => state.paused)).toBe(true);
  art.destroy();
  expect(sprites.every(({ destroy }) => destroy.mock.calls.length === 1)).toBe(true);
});

it("covers the volume with a translucent placeholder until the sprite exists", () => {
  const { rectangles, scene: host, sprites } = scene();
  const art = createPulseSpanArt(3, undefined, 0x9ad48c, host);
  art.draw(VOLUME, 1, "pulse");
  expect(sprites).toEqual([]);
  expect(rectangles).toHaveLength(1);
  const { state } = rectangles[0]!;
  expect([state.x, state.y, state.width, state.height, state.depth]).toEqual([
    100, 200, 144, 48, 3,
  ]);
  expect(state.alpha).toBeLessThan(1);
  art.destroy();
  expect(rectangles[0]!.destroy).toHaveBeenCalledOnce();
});
