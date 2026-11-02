import { type BitmapFont, laidGlyphs } from "@andornaut/game-kit/text/bitmapFont";

import type { Rect } from "../data/types";

export function textInkBounds(
  font: BitmapFont,
  scale: number,
  linePitch: number,
  text: string,
): Rect {
  const lines = text.split("\n");
  const spans = lines.flatMap((line) =>
    laidGlyphs(font, scale, line).flatMap(({ ink }) => ink ?? []),
  );
  const rows = lines.flatMap((line, index) =>
    [...line].flatMap((char) => {
      const glyph = font.glyphs.get(char);
      return glyph && glyph.width > 0 && glyph.height > 0
        ? [
            {
              bottom: index * linePitch + (glyph.yOffset + glyph.height) * scale,
              top: index * linePitch + glyph.yOffset * scale,
            },
          ]
        : [];
    }),
  );
  const x = spans.length ? Math.min(...spans.map(({ left }) => left)) : 0;
  const right = spans.length ? Math.max(...spans.map(({ right }) => right)) : 0;
  const y = rows.length ? Math.min(...rows.map(({ top }) => top)) : 0;
  const bottom = rows.length ? Math.max(...rows.map(({ bottom }) => bottom)) : 0;
  return { height: bottom - y, width: right - x, x, y };
}
