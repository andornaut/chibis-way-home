import { readFileSync } from "node:fs";

import { animationKey } from "@andornaut/game-kit/art/aseprite";
import { sceneStub } from "@andornaut/game-kit/testing/phaser/sceneStub";
import { type Scene, Textures, TintModes } from "phaser";
import { PNG } from "pngjs";
import { expect, it, vi } from "vitest";

import palette from "../../public/art/palette.json" with { type: "json" };
import pauseSheet from "../../public/art/sprites/ui-pause.json" with { type: "json" };
import type { SkillId } from "../data/types/index.ts";
import { SKILL_IDS } from "../progress/index.ts";
import { chromeCanvasTexture } from "../testing/chromeTexture.ts";
import { fitScale } from "../testing/renderScale.ts";
import { PAUSE_VISIBLE_DIAMETER, SKILL_ART, SKILL_BUTTON } from "../ui/index.ts";

vi.mock("phaser", () => ({
  Core: { Events: { POST_STEP: "poststep" } },
  Textures: { FilterMode: { NEAREST: 0 } },
  TintModes: { FILL: 1 },
}));
vi.mock("./cardParts.ts", () => ({
  paletteColour: (_scene: unknown, name: keyof typeof palette.colours) =>
    Number.parseInt(palette.colours[name].slice(1), 16),
}));

import { drawSkillButton } from "./skillButton.ts";

const colour = (name: keyof typeof palette.colours) =>
  Number.parseInt(palette.colours[name].slice(1), 16);

// Skill buttons drawn into a stub game shown at density screen pixels per base pixel.
function fixture(density = 3) {
  function layer(x: number, y: number, art: string, frame?: string) {
    return {
      art,
      clearTint: vi.fn().mockReturnThis(),
      frame,
      play: vi.fn().mockReturnThis(),
      scaleX: 1,
      scaleY: 1,
      setDisplaySize: vi.fn(function (this: { scaleX: number; scaleY: number }, w, h) {
        return Object.assign(this, { scaleX: w / 1000, scaleY: h / 1000 });
      }),
      setFrame(name: string) {
        this.frame = name;
        return this;
      },
      setOrigin: vi.fn().mockReturnThis(),
      setPosition(x: number, y: number) {
        this.x = x;
        this.y = y;
        return this;
      },
      setScale(scaleX: number, scaleY: number) {
        return Object.assign(this, { scaleX, scaleY });
      },
      setSizeToFrame: vi.fn(),
      setTint: vi.fn().mockReturnThis(),
      setTintMode: vi.fn().mockReturnThis(),
      setVisible(visible: boolean) {
        this.visible = visible;
        return this;
      },
      texture: undefined as unknown,
      visible: true,
      x,
      y,
    };
  }
  const sheets: ReturnType<typeof chromeCanvasTexture>[] = [];
  const createCanvas = vi.fn((key: string, width: number, height: number) => {
    const texture = chromeCanvasTexture(key, width, height);
    sheets.push(texture);
    Object.assign(stub.textures.list, { [key]: texture });
    return texture;
  });
  const layers: ReturnType<typeof layer>[] = [];
  const addLayer = (...args: Parameters<typeof layer>) => {
    const node = layer(...args);
    node.texture = stub.textures.list[args[2]];
    layers.push(node);
    stub.children.list.push(node as never);
    return node;
  };
  const stub = sceneStub(vi.fn, {
    add: { image: addLayer, sprite: addLayer },
    scale: fitScale(density),
  });
  Object.assign(stub.textures, { createCanvas });
  Object.assign(stub.game, { scene: { scenes: [stub] } });
  const scene = stub as unknown as Scene;
  const draw = (skill: SkillId = "dash") => {
    const icon = drawSkillButton(scene, { x: 0, y: 0 }, skill);
    const [chrome, glyph] = layers.slice(-2);
    return { chrome: chrome!, glyph: glyph!, icon };
  };
  // The chrome's painted texel under base point x, y of its 48px target.
  const pixel = (chrome: ReturnType<typeof layer>, x: number, y: number) => {
    const sheet = sheets[0]!;
    const scale = sheet.frames.get(chrome.frame!)!.cutWidth / SKILL_BUTTON.target;
    const [r, g, b, alpha] = sheet.pixels(
      chrome.frame!,
      Math.floor(x * scale),
      Math.floor(y * scale),
    );
    return { alpha: alpha!, colour: (r! << 16) | (g! << 8) | b! };
  };
  return { createCanvas, draw, pixel, sheets, stub };
}

it("keeps only the selected ink annulus through cooldown and paints ready faces yellow", () => {
  const { draw, pixel } = fixture();
  const { chrome, glyph, icon } = draw();
  expect(pixel(chrome, 24, 10)).toEqual({ alpha: 255, colour: colour("navy") });
  expect(pixel(chrome, 24, 24)).toEqual({ alpha: 255, colour: colour("navy") });
  expect(glyph.play).toHaveBeenLastCalledWith(animationKey(SKILL_ART.dash, "muted"));
  icon.selected(true);
  icon.ready(true);
  expect(pixel(chrome, 24, 10)).toEqual({ alpha: 255, colour: colour("ink") });
  expect(pixel(chrome, 24, 24)).toEqual({ alpha: 255, colour: colour("yellow") });
  expect(glyph.play).toHaveBeenLastCalledWith(animationKey(SKILL_ART.dash, "ready"));
  expect(glyph.setTint).toHaveBeenLastCalledWith(colour("ink"));
  expect(glyph.setTintMode).toHaveBeenLastCalledWith(TintModes.FILL);
  icon.ready(false);
  expect(pixel(chrome, 24, 10)).toEqual({ alpha: 255, colour: colour("ink") });
  expect(pixel(chrome, 24, 24)).toEqual({ alpha: 255, colour: colour("navy") });
  expect(glyph.clearTint).toHaveBeenCalledTimes(2);
  icon.selected(false);
  expect(pixel(chrome, 24, 10)).toEqual({ alpha: 255, colour: colour("navy") });
});

it("keeps identical outer coverage and native glyph size in every nearest-sampled chrome state", () => {
  const { draw, pixel, sheets } = fixture();
  const { chrome, glyph, icon } = draw();
  expect(chrome.setDisplaySize).toHaveBeenCalledWith(SKILL_BUTTON.target, SKILL_BUTTON.target);
  expect(glyph.art).toBe(SKILL_ART.dash);
  expect(icon.objects).toHaveLength(2);
  const [sheet] = sheets;
  const texels = sheet!.frames.get(chrome.frame!)!.cutWidth;
  // The centre row's summed coverage, in base pixels.
  const width = () =>
    Array.from(
      { length: texels },
      (_, x) => sheet!.pixels(chrome.frame!, x, texels / 2)[3]!,
    ).reduce((sum, alpha) => sum + alpha / 255, 0) /
    (texels / SKILL_BUTTON.target);
  expect(width()).toBeCloseTo(PAUSE_VISIBLE_DIAMETER, 1);
  const envelope = width();
  for (const [selected, ready] of [
    [true, true],
    [true, false],
    [false, false],
    [false, true],
  ] as const) {
    icon.selected(selected);
    icon.ready(ready);
    expect(width()).toBe(envelope);
    expect([glyph.x, glyph.y]).toEqual([16, 16]);
    expect(glyph.setDisplaySize).not.toHaveBeenCalled();
  }
  expect(pixel(chrome, 24, 7.5).alpha).toBeGreaterThan(0);
  expect(pixel(chrome, 24, 7.5).alpha).toBeLessThan(255);
  expect(pixel(chrome, 24, 6.5).alpha).toBe(0);
  expect(pixel(chrome, 0, 0).alpha).toBe(0);
  expect(sheet!.key).toBe("skill-button-chrome");
  expect(sheet!.setFilter).toHaveBeenCalledExactlyOnceWith(Textures.FilterMode.NEAREST);
});

it("paints one texel per screen pixel and repaints when the display scale or pixel ratio changes", () => {
  vi.stubGlobal("devicePixelRatio", 2);
  const { draw, sheets, stub } = fixture(1.5);
  const { chrome } = draw();
  const frames = [...sheets[0]!.frames.values()];
  // 48 base pixels at 1.5 * 2 screen pixels each.
  expect(frames.map((frame) => frame.cutWidth)).toEqual(frames.map(() => 144));
  stub.game.events.emit("poststep");
  expect(sheets[0]!.setSize).toHaveBeenCalledTimes(1);
  vi.stubGlobal("devicePixelRatio", 1);
  stub.game.events.emit("poststep");
  expect(frames.map((frame) => frame.cutWidth)).toEqual(frames.map(() => 72));
  expect(chrome.scaleX * 72).toBeCloseTo((SKILL_BUTTON.target / 1000) * 144);
  Object.assign(stub.scale, fitScale(2.67));
  stub.game.events.emit("poststep");
  expect(frames.map((frame) => frame.cutWidth)).toEqual(frames.map(() => 128));
  expect(chrome.scaleX * 128).toBeCloseTo((SKILL_BUTTON.target / 1000) * 144);
  expect(chrome.setSizeToFrame).toHaveBeenCalledTimes(2);
  vi.unstubAllGlobals();
});

it("preserves ready unselected room illustrations and visibility after moving", () => {
  const { draw, pixel } = fixture();
  const { chrome, glyph, icon } = draw();
  icon.ready(true);
  expect(pixel(chrome, 24, 10)).toEqual({ alpha: 255, colour: colour("yellow") });
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

it("shares one chrome sheet across skills while exactly one selected annulus changes owners", () => {
  const { createCanvas, draw, pixel } = fixture();
  const icons = SKILL_IDS.map((skill) => ({ skill, ...draw(skill) }));
  for (const active of SKILL_IDS) {
    for (const { icon, skill } of icons) {
      icon.selected(skill === active);
      icon.ready(false);
    }
    expect(
      icons
        .filter(({ chrome }) => pixel(chrome, 24, 10).colour === colour("ink"))
        .map(({ skill }) => skill),
    ).toEqual([active]);
  }
  expect(createCanvas).toHaveBeenCalledTimes(1);
});

it("matches the actual Pause rest alpha bounds rather than its frame or pressed swell", () => {
  const image = PNG.sync.read(
    readFileSync(new URL("../../public/art/sprites/ui-pause.png", import.meta.url)),
  );
  const rest = pauseSheet.meta.frameTags.find(({ name }) => name === "rest")!;
  const { frame } = Object.values(pauseSheet.frames)[rest.from]!;
  const occupied: { x: number; y: number }[] = [];
  for (let y = 0; y < frame.h; y++) {
    for (let x = 0; x < frame.w; x++) {
      if (image.data[4 * ((frame.y + y) * image.width + frame.x + x) + 3]) {
        occupied.push({ x, y });
      }
    }
  }
  const xs = occupied.map(({ x }) => x);
  const ys = occupied.map(({ y }) => y);
  expect(Math.max(...xs) - Math.min(...xs) + 1).toBe(PAUSE_VISIBLE_DIAMETER);
  expect(Math.max(...ys) - Math.min(...ys) + 1).toBe(PAUSE_VISIBLE_DIAMETER);
});
