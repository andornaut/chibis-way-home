import type { Scene } from "phaser";
import { expect, it, vi } from "vitest";

vi.mock("./cardParts", () => ({ paletteColour: () => 0 }));

import { drawSkillButton } from "./skillButton";

it("retains the selected bar while its glyph is muted, without tinting the disc", () => {
  const nodes: {
    visible: boolean;
    x: number;
    y: number;
    height: number;
    width: number;
    play: ReturnType<typeof vi.fn>;
    setTint: ReturnType<typeof vi.fn>;
  }[] = [];
  const node = (x: number, y: number, width = 0, height = 0) => {
    const shape = {
      height,
      play: vi.fn().mockReturnThis(),
      setOrigin: vi.fn().mockReturnThis(),
      setPosition(nextX: number, nextY: number) {
        this.x = nextX;
        this.y = nextY;
        return this;
      },
      setTint: vi.fn(),
      setVisible(value: boolean) {
        this.visible = value;
        return this;
      },
      visible: true,
      width,
      x,
      y,
    };
    nodes.push(shape);
    return shape;
  };
  const scene = {
    add: {
      rectangle: (x: number, y: number, width: number, height: number) => node(x, y, width, height),
      sprite: (x: number, y: number) => node(x, y),
    },
  } as unknown as Scene;
  const icon = drawSkillButton(scene, { x: 0, y: 0 }, "dash");
  const disc = nodes[0]!,
    bar = nodes[4]!;
  expect([bar.x, bar.y, bar.width, bar.height]).toEqual([22, 34, 5, 2]);
  expect(bar.visible).toBe(false);
  icon.selected(true);
  icon.ready(false);
  expect(bar.visible).toBe(true);
  expect(disc.setTint).not.toHaveBeenCalled();
  icon.visible(false);
  expect(bar.visible).toBe(false);
  icon.visible(true);
  expect(bar.visible).toBe(true);
  icon.selected(false);
  expect(bar.visible).toBe(false);
});
