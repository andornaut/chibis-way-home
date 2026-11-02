import { animationKey } from "@andornaut/game-kit/art/aseprite";
import { type Scene, TintModes } from "phaser";
import { expect, it, vi } from "vitest";

import palette from "../../public/art/palette.json";
import type { SkillId } from "../data/types";
import { SKILL_ART, SKILL_BUTTON } from "../layout/skillHud";
import { SKILL_IDS } from "../rules/skills";

vi.mock("phaser", () => ({ TintModes: { FILL: 1 } }));

vi.mock("./cardParts", () => ({
  paletteColour: (_scene: unknown, name: keyof typeof palette.colours) =>
    Number.parseInt(palette.colours[name].slice(1), 16),
}));

import { drawSkillButton } from "./skillButton";

const colour = (name: keyof typeof palette.colours) =>
  Number.parseInt(palette.colours[name].slice(1), 16);

function fixture() {
  function layer(x = 0, y = 0, art?: string) {
    let fill = 0;
    const node = {
      art,
      clear() {
        this.pixels.clear();
        return this;
      },
      clearTint: vi.fn().mockReturnThis(),
      fillRect(x: number, y: number, width: number, height: number) {
        for (let row = y; row < y + height; row++) {
          for (let col = x; col < x + width; col++) {
            this.pixels.set(`${col},${row}`, fill);
          }
        }
        return this;
      },
      fillStyle(value: number, alpha: number) {
        expect(alpha).toBe(1);
        fill = value;
        return this;
      },
      pixels: new Map<string, number>(),
      play: vi.fn().mockReturnThis(),
      setOrigin: vi.fn().mockReturnThis(),
      setPosition(x: number, y: number) {
        this.x = x;
        this.y = y;
        return this;
      },
      setTint: vi.fn().mockReturnThis(),
      setTintMode: vi.fn().mockReturnThis(),
      setVisible(visible: boolean) {
        this.visible = visible;
        return this;
      },
      visible: true,
      x,
      y,
    };
    return node;
  }
  const layers: ReturnType<typeof layer>[] = [];
  function addLayer(...args: Parameters<typeof layer>) {
    const node = layer(...args);
    layers.push(node);
    return node;
  }
  const scene = {
    add: {
      graphics: () => addLayer(),
      sprite: (x: number, y: number, art: string) => addLayer(x, y, art),
    },
  } as unknown as Scene;
  const draw = (skill: SkillId = "dash") => {
    const icon = drawSkillButton(scene, { x: 0, y: 0 }, skill);
    const [ring, disc, face, glyph] = layers.slice(-4);
    return { disc: disc!, face: face!, glyph: glyph!, icon, ring: ring! };
  };
  return { draw };
}

it("keeps the selected outer ring through cooldown and paints only ready faces bright", () => {
  const { disc, face, glyph, icon, ring } = fixture().draw();
  expect(disc.art).toBe("ui-pause");
  expect(disc.play).toHaveBeenCalledWith(animationKey("ui-pause", "rest"));
  expect(ring.visible).toBe(false);
  expect(face.pixels.get("17,17")).toBe(colour("navy"));
  expect(glyph.play).toHaveBeenLastCalledWith(animationKey(SKILL_ART.dash, "muted"));
  icon.selected(true);
  icon.ready(true);
  expect(ring.visible).toBe(true);
  expect(face.pixels.get("17,17")).toBe(colour("yellow"));
  expect(glyph.play).toHaveBeenLastCalledWith(animationKey(SKILL_ART.dash, "ready"));
  expect(glyph.setTint).toHaveBeenLastCalledWith(colour("ink"));
  expect(glyph.setTintMode).toHaveBeenLastCalledWith(TintModes.FILL);
  icon.ready(false);
  expect(ring.visible).toBe(true);
  expect(face.pixels.get("17,17")).toBe(colour("navy"));
  expect(glyph.play).toHaveBeenLastCalledWith(animationKey(SKILL_ART.dash, "muted"));
  expect(glyph.clearTint).toHaveBeenCalledTimes(2);
  icon.selected(false);
  expect(ring.visible).toBe(false);
});

it("keeps the integer rings inside the existing target and masks the full circular face", () => {
  const { face, ring } = fixture().draw();
  expect(ring.pixels.get("17,-4")).toBe(colour("ink"));
  expect(ring.pixels.get("17,-3")).toBe(colour("yellow"));
  expect(ring.pixels.get("17,-1")).toBe(colour("ink"));
  const points = [...ring.pixels.keys()].map((point) => point.split(",").map(Number));
  expect(Math.min(...points.map(([x]) => x! + ring.x))).toBe(3);
  expect(Math.max(...points.map(([x]) => x! + ring.x))).toBe(SKILL_BUTTON.target - 3);
  expect(Math.min(...points.map(([, y]) => y! + ring.y))).toBe(3);
  expect(Math.max(...points.map(([, y]) => y! + ring.y))).toBe(SKILL_BUTTON.target - 3);
  expect(face.pixels.get("17,4")).toBe(colour("navy"));
  expect(face.pixels.has("17,3")).toBe(false);
  expect(face.pixels.has("4,4")).toBe(false);
});

it("preserves ready unselected room/detail illustrations and owned visibility after moving", () => {
  const { disc, face, glyph, icon, ring } = fixture().draw();
  icon.ready(true);
  expect(ring.visible).toBe(false);
  expect(face.pixels.get("17,17")).toBe(colour("yellow"));
  expect(glyph.play).toHaveBeenLastCalledWith(animationKey(SKILL_ART.dash, "ready"));
  expect(glyph.setTint).toHaveBeenLastCalledWith(colour("ink"));
  expect(glyph.setTintMode).toHaveBeenLastCalledWith(TintModes.FILL);
  icon.selected(true);
  icon.place({ x: 100, y: 50 });
  expect([ring.x, ring.y, disc.x, disc.y, face.x, face.y, glyph.x, glyph.y]).toEqual([
    107, 57, 107, 57, 107, 57, 116, 66,
  ]);
  icon.visible(false);
  expect([ring, disc, face, glyph].every((node) => !node.visible)).toBe(true);
  icon.visible(true);
  expect([ring, disc, face, glyph].every((node) => node.visible)).toBe(true);
});

it("shows exactly one outer ring as the exclusive selected skill changes", () => {
  const { draw } = fixture();
  const icons = SKILL_IDS.map((skill) => ({ skill, ...draw(skill) }));
  for (const active of SKILL_IDS) {
    for (const { icon, skill } of icons) {
      icon.selected(skill === active);
      icon.ready(false);
    }
    expect(icons.filter(({ ring }) => ring.visible).map(({ skill }) => skill)).toEqual([active]);
  }
});
