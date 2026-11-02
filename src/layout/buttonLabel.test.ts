import { readFileSync } from "node:fs";

import { inkWidth, parseBitmapFont } from "@andornaut/game-kit/text/bitmapFont";
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";

import fontBody from "../../public/art/fonts/font-body.fnt?raw";
import palette from "../../public/art/palette.json";
import secondary from "../../public/art/sprites/ui-button.json";
import primary from "../../public/art/sprites/ui-button-primary.json";
import { SCREEN } from "../data/screen";
import { TEXT } from "../data/text";
import {
  buttonFace,
  buttonLabelPlacement,
  centredLabel,
  PLAY_MARK,
  TEXT_BUTTON,
} from "./buttonLabel";
import { CARD_TEXT_SCALE } from "./pauseCard";
import { startScreenLayout } from "./startScreen";

const button = { height: 28, width: 72, x: 452, y: 198 };

describe("centredLabel", () => {
  it.each([
    { expected: { labelX: 468 }, ink: 40, mark: undefined, name: "an even label" },
    {
      expected: { labelX: 468 },
      ink: 39,
      mark: undefined,
      name: "an odd label, its spare pixel after it",
    },
    { expected: { labelX: 452 }, ink: 72, mark: undefined, name: "a label as wide as the button" },
    {
      expected: { labelX: 473, markX: 462 },
      ink: 40,
      mark: { gap: 6, width: 5 },
      name: "a label with a mark before it",
    },
  ])("places $name", ({ expected, ink, mark }) => {
    expect(centredLabel(button, ink, mark)).toEqual(expected);
  });

  it("leaves the spare pixel after an unmarked 41 px label", () => {
    const ink = 41;
    const { labelX } = centredLabel(button, ink);
    const before = labelX - button.x;
    const after = button.x + button.width - (labelX + ink);
    expect(after - before).toBeGreaterThanOrEqual(0);
    expect(after - before).toBeLessThanOrEqual(1);
  });

  it.each([
    ["Start", TEXT.start.start],
    ["Continue", TEXT.start.continue],
  ])("fits the start screen's unmarked %s label with standard padding", (_, text) => {
    const { button: start } = startScreenLayout(SCREEN, true, false).start;
    const ink = inkWidth(parseBitmapFont(fontBody), CARD_TEXT_SCALE, text);
    const { labelX } = centredLabel(start, ink);
    const margins = [labelX - start.x, start.x + start.width - (labelX + ink)];
    expect(Math.min(...margins)).toBeGreaterThanOrEqual(16);
  });

  it("fits the start screen's Restart label on its button", () => {
    const restart = startScreenLayout(SCREEN, true, true).restart?.button;
    const ink = inkWidth(parseBitmapFont(fontBody), CARD_TEXT_SCALE, TEXT.start.restart);
    const labelX = restart && centredLabel(restart, ink).labelX;
    const margins = restart &&
      labelX !== undefined && [labelX - restart.x, restart.x + restart.width - (labelX + ink)];
    expect(margins && Math.min(...margins)).toBeGreaterThanOrEqual(16);
  });

  it("centres Start's label without a play mark on the primary face", () => {
    const ink = inkWidth(parseBitmapFont(fontBody), CARD_TEXT_SCALE, TEXT.start.start);
    const button = startScreenLayout(SCREEN, true, false).start.button;
    const { labelX, markX } = centredLabel(button, ink);
    expect(markX).toBeUndefined();
    expect(labelX + ink / 2).toBe(button.x + button.width / 2);
  });
});

it.each([
  { height: 48, marked: false, text: "Continue" },
  { height: 48, marked: true, text: "Try again" },
  { height: 28, marked: false, text: "Install" },
])(
  "centres actual $text ink and its optional mark in every visible $height px face",
  ({ height, marked, text }) => {
    const font = parseBitmapFont(fontBody);
    const button = { height, width: 192, x: 40, y: 50 };
    const glyphs = [...text]
      .map((char) => font.glyphs.get(char)!)
      .filter((glyph) => glyph.width > 0 && glyph.height > 0);
    const top = Math.min(...glyphs.map((glyph) => glyph.yOffset)) * CARD_TEXT_SCALE;
    const bottom =
      Math.max(...glyphs.map((glyph) => glyph.yOffset + glyph.height)) * CARD_TEXT_SCALE;
    const width = inkWidth(font, CARD_TEXT_SCALE, text);
    for (const state of ["normal", "pressed", "disabled"] as const) {
      const face = buttonFace(state, button);
      const at = buttonLabelPlacement(
        font,
        CARD_TEXT_SCALE,
        marked ? PLAY_MARK : undefined,
        face,
        text,
      );
      expect(at.label.y + (top + bottom) / 2).toBe(face.y + face.height / 2);
      if (height === TEXT_BUTTON.height) {
        expect(at.label.y + top - face.y).toBeGreaterThanOrEqual(TEXT_BUTTON.verticalInset);
      }
      const left = at.mark?.x ?? at.label.x;
      expect(
        Math.abs(
          left +
            (width + (marked ? PLAY_MARK.width + PLAY_MARK.gap : 0)) / 2 -
            face.x -
            face.width / 2,
        ),
      ).toBeLessThanOrEqual(0.5);
      if (at.mark) {
        expect(at.mark.y + PLAY_MARK.height / 2).toBe(face.y + face.height / 2);
      }
    }
  },
);

it("subtracts visible left/top bearings while retaining kerning and full glyph size", () => {
  const font = {
    glyphs: new Map([
      ["A", { advance: 8, height: 6, width: 5, xOffset: -2, yOffset: 3 }],
      ["V", { advance: 8, height: 7, width: 6, xOffset: 1, yOffset: 2 }],
    ]),
    kernings: new Map([["AV", -2]]),
    lineHeight: 12,
  };
  const face = { height: 32, width: 64, x: 10, y: 20 };
  const at = buttonLabelPlacement(font, 2, undefined, face, "AV");
  expect(at.label).toEqual({ x: 31, y: 25 });
});

it("uses the actual native face pixels for primary, secondary and flat disabled content bounds", () => {
  for (const [name, sheet, normalColour] of [
    ["ui-button", secondary, "grey"],
    ["ui-button-primary", primary, "dslate"],
  ] as const) {
    const png = PNG.sync.read(
      readFileSync(new URL(`../../public/art/sprites/${name}.png`, import.meta.url)),
    );
    for (const state of ["normal", "pressed", "disabled"] as const) {
      const tag = sheet.meta.frameTags.find(({ name }) => name === state)!;
      const frame = Object.values(sheet.frames)[tag.from]!.frame;
      const colour = palette.colours[state === "disabled" ? "lgrey" : normalColour];
      const rgb = [1, 3, 5].map((index) => Number.parseInt(colour.slice(index, index + 2), 16));
      const occupied: { x: number; y: number }[] = [];
      for (let y = 0; y < frame.h; y++) {
        for (let x = 0; x < frame.w; x++) {
          const index = ((frame.y + y) * png.width + frame.x + x) * 4;
          if (
            png.data[index + 3] &&
            rgb.every((value, channel) => png.data[index + channel] === value)
          ) {
            occupied.push({ x, y });
          }
        }
      }
      const top = Math.min(...occupied.map(({ y }) => y));
      const bottom = Math.max(...occupied.map(({ y }) => y)) + 1;
      expect(buttonFace(state, { height: frame.h, width: frame.w, x: 0, y: 0 })).toMatchObject({
        height: bottom - top,
        y: top,
      });
    }
  }
});
