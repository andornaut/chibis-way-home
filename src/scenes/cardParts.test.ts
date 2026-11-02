import { type AsepriteSheet, sheetTags } from "@andornaut/game-kit/art/aseprite";
import { parseBitmapFont } from "@andornaut/game-kit/text/bitmapFont";
import type { Scene } from "phaser";
import { describe, expect, it, vi } from "vitest";

import fontBody from "../../public/art/fonts/font-body.fnt?raw";
import manifest from "../../public/art/manifest.json";
import palette from "../../public/art/palette.json";
import button from "../../public/art/sprites/ui-button.json";
import primary from "../../public/art/sprites/ui-button-primary.json";
import playMarkJson from "../../public/art/sprites/ui-play-mark.json";
import { labelledButton } from "../layout/labelledButton";
import { ART_MANIFEST_KEY } from "../view/aseprite";
import {
  addButtonLabel,
  addTextButton,
  BUTTON,
  pressTextButton,
  PRIMARY_BUTTON,
  setTextButtonEnabled,
} from "./cardParts";

const playMark = playMarkJson as AsepriteSheet;

function drawing(sheet = playMark, native = false) {
  const node = () => ({
    setFrame: vi.fn().mockReturnThis(),
    setOrigin: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockReturnThis(),
    setScale: vi.fn().mockReturnThis(),
    setTint: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
    setY: vi.fn().mockReturnThis(),
  });
  const image = vi
    .fn<(x: number, y: number, texture: string, frame?: string) => ReturnType<typeof node>>()
    .mockImplementation(node);
  const nineslice = vi.fn().mockImplementation(node);
  const json = new Map<string, unknown>([
    [ART_MANIFEST_KEY, manifest],
    ["palette", palette],
    ["ui-button", button],
    ["ui-button-primary", primary],
    ["ui-play-mark", sheet],
  ]);
  const bitmapText = vi.fn().mockImplementation(node);
  const font = parseBitmapFont(fontBody);
  const chars = native
    ? Object.fromEntries(
        [...font.glyphs].map(([char, glyph]) => [
          char.codePointAt(0)!,
          { ...glyph, kerning: {}, xAdvance: glyph.advance },
        ]),
      )
    : {};
  const scene = {
    add: { bitmapText, image, nineslice },
    cache: {
      bitmapFont: { get: () => ({ data: { chars, lineHeight: native ? font.lineHeight : 12 } }) },
      json: { get: (key: string) => json.get(key) },
    },
  } as unknown as Scene;
  return { bitmapText, image, json, nineslice, scene };
}

const rect = { height: 48, width: 160, x: 0, y: 0 };
const layout = labelledButton(rect);

describe("button play-mark frames", () => {
  it.each([
    { name: "primary", style: PRIMARY_BUTTON, tag: "light" },
    { name: "secondary", style: BUTTON, tag: "rest" },
    { name: "default", style: undefined, tag: "rest" },
  ])("draws the actual $tag tag for $name buttons", ({ style, tag }) => {
    const { image, scene } = drawing();
    addTextButton(scene, layout, "", { marked: true, ...(style && { style }) });
    const frame = sheetTags(playMark).get(tag)![0]!.frame;
    expect(image).toHaveBeenCalledExactlyOnceWith(
      expect.any(Number),
      expect.any(Number),
      "ui-play-mark",
      frame,
    );
  });

  it("preserves the rest tag for direct legacy labels", () => {
    const { image, scene } = drawing();
    addButtonLabel(scene, { colour: 0, marked: true }, rect, "");
    expect(image.mock.calls[0]![3]).toBe(sheetTags(playMark).get("rest")![0]!.frame);
  });

  it("rejects a marked primary button when the light asset tag is absent", () => {
    const { scene } = drawing({
      ...playMark,
      meta: {
        ...playMark.meta,
        frameTags: playMark.meta.frameTags!.filter(({ name }) => name !== "light"),
      },
    });
    expect(() => addTextButton(scene, layout, "", { marked: true, style: PRIMARY_BUTTON })).toThrow(
      "No light frame for ui-play-mark",
    );
  });
});

describe("disabled text buttons", () => {
  it.each([BUTTON, PRIMARY_BUTTON])(
    "uses the actual disabled tag for $art and restores its original enabled style",
    (style) => {
      const { nineslice, scene } = drawing();
      const result = addTextButton(scene, layout, "", { disabled: true, marked: true, style });
      const sheet = style === BUTTON ? button : primary;
      const tags = sheetTags(sheet as AsepriteSheet);
      expect(nineslice.mock.calls.map((call) => call[3])).toEqual([
        tags.get("disabled")![0]!.frame,
        tags.get("disabled")![0]!.frame,
      ]);
      expect(result.label.label.setTint).toHaveBeenLastCalledWith(
        Number.parseInt(palette.colours.dslate.slice(1), 16),
      );
      pressTextButton(result, true);
      expect(result.faces.normal.setVisible).toHaveBeenLastCalledWith(true);
      expect(result.faces.pressed.setVisible).toHaveBeenLastCalledWith(false);
      expect(result.label.label.setY).toHaveBeenLastCalledWith(
        result.label.positions.disabled.label.y,
      );
      setTextButtonEnabled(scene, true, result);
      expect(result.faces.normal.setFrame).toHaveBeenLastCalledWith(tags.get("normal")![0]!.frame);
      expect(result.faces.pressed.setFrame).toHaveBeenLastCalledWith(
        tags.get("pressed")![0]!.frame,
      );
      expect(result.label.label.setTint).toHaveBeenLastCalledWith(
        Number.parseInt(palette.colours[style.label].slice(1), 16),
      );
      expect(result.label.mark!.setFrame).toHaveBeenLastCalledWith(
        sheetTags(playMark).get(style === PRIMARY_BUTTON ? "light" : "rest")![0]!.frame,
      );
      pressTextButton(result, true);
      expect(result.faces.pressed.setVisible).toHaveBeenLastCalledWith(true);
      expect(result.label.label.setY).toHaveBeenLastCalledWith(
        result.label.positions.pressed.label.y,
      );
      setTextButtonEnabled(scene, false, result);
      for (const face of Object.values(result.faces)) {
        expect(face.setFrame).toHaveBeenLastCalledWith(tags.get("disabled")![0]!.frame);
      }
      expect(result.label.label.setY).toHaveBeenLastCalledWith(
        result.label.positions.disabled.label.y,
      );
      expect(result.label.mark!.setFrame).toHaveBeenLastCalledWith(
        sheetTags(playMark).get("rest")![0]!.frame,
      );
    },
  );

  it("rejects an atomic asset pairing without its disabled tag", () => {
    const { json, scene } = drawing();
    json.set(BUTTON.art, {
      ...button,
      meta: {
        ...button.meta,
        frameTags: button.meta.frameTags.filter(({ name }) => name !== "disabled"),
      },
    });
    expect(() => addTextButton(scene, layout, "", { disabled: true })).toThrow(
      "No disabled frame for ui-button",
    );
  });
});

it("centres native Continue ink on each visible face and applies its pressed shift once", () => {
  const { bitmapText, scene } = drawing(playMark, true);
  const result = addTextButton(scene, layout, "Continue", { style: PRIMARY_BUTTON });
  expect(bitmapText).toHaveBeenLastCalledWith(expect.any(Number), 14, "font-body", "Continue");
  pressTextButton(result, true);
  expect(result.label.label.setY).toHaveBeenLastCalledWith(16);
  setTextButtonEnabled(scene, false, result);
  expect(result.label.label.setY).toHaveBeenLastCalledWith(16);
  pressTextButton(result, true);
  expect(result.label.label.setY).toHaveBeenLastCalledWith(16);
  setTextButtonEnabled(scene, true, result);
  expect(result.label.label.setY).toHaveBeenLastCalledWith(14);
});
