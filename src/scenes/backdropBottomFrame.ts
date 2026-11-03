import type { Textures } from "phaser";

const BOTTOM_FRAME = "__viewport-bottom";

// A frame shares the original pixels, including alpha, without copying or changing the image.
export function backdropBottomFrame(texture: Textures.Texture): string {
  if (!texture.has(BOTTOM_FRAME)) {
    const frame = texture.get();
    const first = texture.firstFrame;
    texture.add(
      BOTTOM_FRAME,
      frame.sourceIndex,
      frame.cutX,
      frame.cutY + frame.cutHeight - 1,
      frame.cutWidth,
      1,
    );
    // Adding a named frame changes Phaser's default when only __BASE existed.
    texture.firstFrame = first;
  }
  return BOTTOM_FRAME;
}
