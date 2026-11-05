import { animationKey } from "@andornaut/game-kit/art/aseprite";
import type { Scene } from "phaser";
import { expect, it, vi } from "vitest";

import { createTetherArt } from "./tetherArt";

function item() {
  const state = {
    anim: undefined as string | undefined,
    depth: 0,
    height: 0,
    rotation: 0,
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
    },
    destroy: vi.fn(),
    play: vi.fn((key: string) => {
      state.anim = key;
      return object;
    }),
    setDepth: vi.fn((depth: number) => {
      state.depth = depth;
      return object;
    }),
    setOrigin: vi.fn(() => object),
    setPosition: vi.fn((x: number, y: number) => {
      Object.assign(state, { x, y });
      return object;
    }),
    setRotation: vi.fn((rotation: number) => {
      state.rotation = rotation;
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

it("repeats cable segments from the rail and rests the hook on the anchor once the sprite exists", () => {
  const { rectangles, scene: host, sprites } = scene();
  const art = createTetherArt(-1, { key: "freight-crane-cable", size: 8 }, 0, host);
  art.draw({ anchor: { x: 140, y: 132 }, kind: "rail", railY: 100 });
  expect(rectangles).toEqual([]);
  expect(sprites.map(({ state }) => [state.anim, state.x, state.y])).toEqual([
    [animationKey("freight-crane-cable", "cable"), 136, 100],
    [animationKey("freight-crane-cable", "cable"), 136, 108],
    [animationKey("freight-crane-cable", "cable"), 136, 116],
    [animationKey("freight-crane-cable", "hook"), 136, 124],
  ]);
  // Behind the object, the hook over the cables.
  expect(sprites.every(({ state }) => state.depth < 0)).toBe(true);
  expect(sprites[3]!.state.depth).toBeGreaterThan(sprites[0]!.state.depth);
  // A shorter line hides the spare segments; moving sideways keeps it centred.
  art.draw({ anchor: { x: 160, y: 124 }, kind: "rail", railY: 100 });
  expect(
    sprites.filter(({ state }) => state.visible).map(({ state }) => [state.x, state.y]),
  ).toEqual([
    [156, 100],
    [156, 108],
    [156, 116],
  ]);
  art.destroy();
  expect(sprites.every(({ destroy }) => destroy.mock.calls.length === 1)).toBe(true);
});

it("draws a placeholder line from the rail to the anchor until the sprite exists", () => {
  const { rectangles, scene: host, sprites } = scene();
  const art = createTetherArt(-1, undefined, 0xc0cbdc, host);
  art.draw({ anchor: { x: 140, y: 196 }, kind: "rail", railY: 100 });
  expect(sprites).toEqual([]);
  expect(rectangles).toHaveLength(1);
  const { state } = rectangles[0]!;
  expect([state.x, state.y, state.width, state.height, state.visible, state.depth]).toEqual([
    139,
    100,
    2,
    96,
    true,
    -1,
  ]);
});

it("places idle spoke segments from the pivot to the anchor at an angle, unrotated", () => {
  const { scene: host, sprites } = scene();
  const art = createTetherArt(-1, { key: "windmill-spoke", size: 8 }, 0, host);
  // A 3-4-5 line, 40 long: five segments, the last centred 4 short of the anchor.
  art.draw({ anchor: { x: 124, y: 132 }, kind: "pivot", pivot: { x: 100, y: 100 } });
  expect(sprites.map(({ state }) => [state.anim, state.x, state.y, state.rotation])).toEqual(
    [
      [98, 99],
      [103, 106],
      [108, 112],
      [113, 118],
      [118, 125],
    ].map(([x, y]) => [animationKey("windmill-spoke", "idle"), x, y, 0]),
  );
  expect(sprites.every(({ state }) => state.depth === -1)).toBe(true);
});

it("draws a placeholder spoke from the pivot to the anchor until the sprite exists", () => {
  const { rectangles, scene: host } = scene();
  const art = createTetherArt(-1, undefined, 0xc0cbdc, host);
  art.draw({ anchor: { x: 100, y: 160 }, kind: "pivot", pivot: { x: 100, y: 100 } });
  const { state } = rectangles[0]!;
  expect([state.x, state.y, state.width, state.height, state.rotation]).toEqual([
    100,
    100,
    60,
    2,
    Math.PI / 2,
  ]);
});
