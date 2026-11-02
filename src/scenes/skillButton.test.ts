import { animationKey } from "@andornaut/game-kit/art/aseprite";
import type { Scene } from "phaser";
import { expect, it, vi } from "vitest";

vi.mock("./cardParts", () => ({ paletteColour: () => 0 }));

import { SKILL_ART } from "../layout/skillHud";
import { drawSkillButton } from "./skillButton";

it("shows readiness independently of selection and retains the selected bar while muted", () => {
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
    glyph = nodes[2]!,
    bar = nodes[4]!;
  expect([bar.x, bar.y, bar.width, bar.height]).toEqual([22, 34, 5, 2]);
  expect(bar.visible).toBe(false);
  expect(glyph.play).toHaveBeenLastCalledWith(animationKey(SKILL_ART.dash, "muted"));
  icon.ready(true);
  expect(glyph.play).toHaveBeenLastCalledWith(animationKey(SKILL_ART.dash, "ready"));
  expect(bar.visible).toBe(false);
  icon.selected(true);
  expect(glyph.play).toHaveBeenLastCalledWith(animationKey(SKILL_ART.dash, "ready"));
  expect(bar.visible).toBe(true);
  icon.ready(false);
  expect(glyph.play).toHaveBeenLastCalledWith(animationKey(SKILL_ART.dash, "muted"));
  expect(bar.visible).toBe(true);
  expect(disc.setTint).not.toHaveBeenCalled();
  icon.visible(false);
  expect(bar.visible).toBe(false);
  icon.visible(true);
  expect(bar.visible).toBe(true);
  icon.selected(false);
  icon.ready(true);
  expect(glyph.play).toHaveBeenLastCalledWith(animationKey(SKILL_ART.dash, "ready"));
  expect(bar.visible).toBe(false);
});
