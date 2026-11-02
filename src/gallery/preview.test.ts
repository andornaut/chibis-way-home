import type { BitmapFont } from "@andornaut/game-kit/text/bitmapFont";
import { expect, it } from "vitest";

import { fontPreview, galleryFrame } from "./preview";

it.each([
  { at: 99, once: false, result: "first" },
  { at: 100, once: false, result: "last" },
  { at: 300, once: false, result: "first" },
  { at: 300, once: true, result: "last" },
])("shows $result at $at ms with once=$once", ({ at, once, result }) => {
  expect(
    galleryFrame(
      [
        { duration: 100, frame: "first" },
        { duration: 200, frame: "last" },
      ],
      once,
      at,
    ),
  ).toBe(result);
});
it("rejects an empty animation instead of drawing an unknown frame", () => {
  expect(() => galleryFrame([], false, 0)).toThrow("no frames");
});
it("maps font crops through native glyph advances and kerning without clipping bearings", () => {
  const font: BitmapFont = {
    glyphs: new Map([
      ["A", { advance: 4, height: 5, width: 3, xOffset: -1, yOffset: 2 }],
      ["V", { advance: 4, height: 5, width: 3, xOffset: 0, yOffset: 1 }],
    ]),
    kernings: new Map([["AV", -1]]),
    lineHeight: 8,
  };
  const result = fontPreview(font, (char) => ({ h: 5, w: 3, x: char === "A" ? 0 : 3, y: 0 }), [
    "AV",
    "?A",
  ]);
  expect(result).toEqual({
    glyphs: [
      { crop: { h: 5, w: 3, x: 0, y: 0 }, x: 0, y: 2 },
      { crop: { h: 5, w: 3, x: 3, y: 0 }, x: 4, y: 1 },
      { crop: { h: 5, w: 3, x: 0, y: 0 }, x: 0, y: 10 },
    ],
    height: 16,
    width: 8,
  });
});
