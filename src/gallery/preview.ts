import type { AnimationFrame } from "@andornaut/game-kit/art/aseprite";
import { advanceWidth, type BitmapFont, laidGlyphs } from "@andornaut/game-kit/text/bitmapFont";

export interface Crop {
  readonly h: number;
  readonly w: number;
  readonly x: number;
  readonly y: number;
}

// A gallery player holds once-only tags; looping tags retain their exported durations.
export function galleryFrame(
  frames: readonly AnimationFrame[],
  once: boolean,
  elapsedMs: number,
): string {
  if (!frames.length) {
    throw new Error("Gallery animation has no frames");
  }
  const duration = frames.reduce((sum, frame) => sum + frame.duration, 0);
  if (once && elapsedMs >= duration) {
    return frames.at(-1)!.frame;
  }
  let elapsed = Math.max(0, elapsedMs) % duration;
  for (const frame of frames) {
    if (elapsed < frame.duration) {
      return frame.frame;
    }
    elapsed -= frame.duration;
  }
  return frames.at(-1)!.frame;
}

export function fontPreview(
  font: BitmapFont,
  cropOf: (char: string) => Crop | undefined,
  lines: readonly string[],
) {
  const glyphs = lines.flatMap((line, row) =>
    laidGlyphs(font, 1, line).flatMap(({ char, ink }) => {
      const crop = cropOf(char),
        glyph = font.glyphs.get(char);
      return crop && glyph && ink
        ? [{ crop, x: ink.left, y: row * font.lineHeight + glyph.yOffset }]
        : [];
    }),
  );
  const left = Math.min(0, ...glyphs.map(({ x }) => x));
  const top = Math.min(0, ...glyphs.map(({ y }) => y));
  return {
    glyphs: glyphs.map((glyph) => ({ ...glyph, x: glyph.x - left, y: glyph.y - top })),
    height:
      Math.max(font.lineHeight * lines.length, ...glyphs.map(({ crop, y }) => y + crop.h)) - top,
    width:
      Math.max(
        1,
        ...lines.map((line) => advanceWidth(font, 1, line)),
        ...glyphs.map(({ crop, x }) => x + crop.w),
      ) - left,
  };
}
