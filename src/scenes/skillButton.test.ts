import { animationKey } from "@andornaut/game-kit/art/aseprite";
import { type Scene, Textures, TintModes } from "phaser";
import { expect, it, vi } from "vitest";

import palette from "../../public/art/palette.json";
import type { SkillId } from "../data/types";
import { SKILL_ART, SKILL_BUTTON } from "../layout/skillHud";
import { SKILL_IDS } from "../rules/skills";

vi.mock("phaser", () => ({ Textures: { FilterMode: { LINEAR: 1 } }, TintModes: { FILL: 1 } }));
vi.mock("./cardParts", () => ({
  paletteColour: (_scene: unknown, name: keyof typeof palette.colours) =>
    Number.parseInt(palette.colours[name].slice(1), 16),
}));

import { drawSkillButton } from "./skillButton";

const colour = (name: keyof typeof palette.colours) =>
  Number.parseInt(palette.colours[name].slice(1), 16);

function fixture() {
  function layer(x: number, y: number, art: string) {
    return {
      art,
      clearTint: vi.fn().mockReturnThis(),
      play: vi.fn().mockReturnThis(),
      setDisplaySize: vi.fn().mockReturnThis(),
      setOrigin: vi.fn().mockReturnThis(),
      setPosition(x: number, y: number) {
        this.x = x;
        this.y = y;
        return this;
      },
      setTexture(key: string) {
        this.art = key;
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
  }
  const textures = new Map<
    string,
    {
      image: { data: Uint8ClampedArray; height: number; width: number };
      setFilter: ReturnType<typeof vi.fn>;
    }
  >();
  const createCanvas = vi.fn((key: string, width: number, height: number) => {
    const image = { data: new Uint8ClampedArray(width * height * 4), height, width };
    const setFilter = vi.fn();
    return {
      getContext: () => ({
        createImageData: () => image,
        putImageData: () => textures.set(key, { image, setFilter }),
      }),
      refresh: vi.fn(),
      setFilter,
    };
  });
  const layers: ReturnType<typeof layer>[] = [];
  const addLayer = (...args: Parameters<typeof layer>) => {
    const node = layer(...args);
    layers.push(node);
    return node;
  };
  const scene = {
    add: { image: addLayer, sprite: addLayer },
    textures: { createCanvas, exists: (key: string) => textures.has(key) },
  } as unknown as Scene;
  const draw = (skill: SkillId = "dash") => {
    const icon = drawSkillButton(scene, { x: 0, y: 0 }, skill);
    const [chrome, glyph] = layers.slice(-2);
    return { chrome: chrome!, glyph: glyph!, icon };
  };
  const pixel = (chrome: ReturnType<typeof layer>, x: number, y: number) => {
    const { image } = textures.get(chrome.art)!;
    const scale = image.width / SKILL_BUTTON.target;
    const offset = 4 * (Math.floor(y * scale) * image.width + Math.floor(x * scale));
    const [r, g, b, alpha] = image.data.slice(offset, offset + 4);
    return { alpha: alpha!, colour: (r! << 16) | (g! << 8) | b! };
  };
  return { createCanvas, draw, pixel, textures };
}

it("keeps only the selected ink annulus through cooldown and paints ready faces yellow", () => {
  const { draw, pixel } = fixture();
  const { chrome, glyph, icon } = draw();
  expect(pixel(chrome, 24, 3).alpha).toBe(0);
  expect(pixel(chrome, 24, 24)).toEqual({ alpha: 255, colour: colour("navy") });
  expect(glyph.play).toHaveBeenLastCalledWith(animationKey(SKILL_ART.dash, "muted"));
  icon.selected(true);
  icon.ready(true);
  expect(pixel(chrome, 24, 3)).toEqual({ alpha: 255, colour: colour("ink") });
  expect(pixel(chrome, 24, 24)).toEqual({ alpha: 255, colour: colour("yellow") });
  expect(glyph.play).toHaveBeenLastCalledWith(animationKey(SKILL_ART.dash, "ready"));
  expect(glyph.setTint).toHaveBeenLastCalledWith(colour("ink"));
  expect(glyph.setTintMode).toHaveBeenLastCalledWith(TintModes.FILL);
  icon.ready(false);
  expect(pixel(chrome, 24, 3)).toEqual({ alpha: 255, colour: colour("ink") });
  expect(pixel(chrome, 24, 24)).toEqual({ alpha: 255, colour: colour("navy") });
  expect(glyph.clearTint).toHaveBeenCalledTimes(2);
  icon.selected(false);
  expect(pixel(chrome, 24, 3).alpha).toBe(0);
});

it("smooths only the circle edges inside the unchanged target with locally filtered chrome", () => {
  const { draw, pixel, textures } = fixture();
  const { chrome, glyph, icon } = draw();
  expect(chrome.setDisplaySize).toHaveBeenCalledWith(SKILL_BUTTON.target, SKILL_BUTTON.target);
  expect(glyph.art).toBe(SKILL_ART.dash);
  expect(icon.objects).toHaveLength(2);
  expect(pixel(chrome, 24, 6.5).alpha).toBeGreaterThan(0);
  expect(pixel(chrome, 24, 6.5).alpha).toBeLessThan(255);
  expect(pixel(chrome, 24, 7.5).alpha).toBe(255);
  icon.selected(true);
  expect(pixel(chrome, 24, 2.5).alpha).toBeGreaterThan(0);
  expect(pixel(chrome, 24, 2.5).alpha).toBeLessThan(255);
  expect(pixel(chrome, 24, 1.5).alpha).toBe(0);
  expect(pixel(chrome, 0, 0).alpha).toBe(0);
  for (const [key, texture] of textures) {
    expect(key.startsWith("skill-button-chrome-")).toBe(true);
    expect(texture.image.width).toBeGreaterThan(SKILL_BUTTON.target);
    expect(texture.setFilter).toHaveBeenCalledExactlyOnceWith(Textures.FilterMode.LINEAR);
  }
});

it("preserves ready unselected room illustrations and visibility after moving", () => {
  const { draw, pixel } = fixture();
  const { chrome, glyph, icon } = draw();
  icon.ready(true);
  expect(pixel(chrome, 24, 3).alpha).toBe(0);
  expect(pixel(chrome, 24, 24)).toEqual({ alpha: 255, colour: colour("yellow") });
  expect(glyph.play).toHaveBeenLastCalledWith(animationKey(SKILL_ART.dash, "ready"));
  icon.place({ x: 100, y: 50 });
  expect([chrome.x, chrome.y, glyph.x, glyph.y]).toEqual([100, 50, 116, 66]);
  icon.visible(false);
  expect(icon.objects.every((node) => !(node as unknown as { visible: boolean }).visible)).toBe(
    true,
  );
  icon.visible(true);
  expect(icon.objects.every((node) => (node as unknown as { visible: boolean }).visible)).toBe(
    true,
  );
});

it("reuses chrome across skills while exactly one selected annulus changes owners", () => {
  const { createCanvas, draw, pixel } = fixture();
  const icons = SKILL_IDS.map((skill) => ({ skill, ...draw(skill) }));
  for (const active of SKILL_IDS) {
    for (const { icon, skill } of icons) {
      icon.selected(skill === active);
      icon.ready(false);
    }
    expect(
      icons.filter(({ chrome }) => pixel(chrome, 24, 3).alpha > 0).map(({ skill }) => skill),
    ).toEqual([active]);
  }
  expect(createCanvas).toHaveBeenCalledTimes(2);
});
