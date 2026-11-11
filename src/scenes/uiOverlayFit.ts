import type { Size, UiProjection } from "@andornaut/game-kit/view/phaser/uiCommands";
import { uiProjection } from "@andornaut/game-kit/view/phaser/uiProjection";

interface WorldCanvas {
  readonly clientHeight: number;
  readonly clientWidth: number;
  readonly height: number;
  readonly style: Readonly<Pick<CSSStyleDeclaration, "height" | "width">>;
  readonly width: number;
}

// The UI overlay's CSS size and projection over the WebGL canvas world. The overlay takes world's
// CSS size, and its backing is that at the full device pixel ratio, while the projection reads
// world's backing, in device pixels at r (followFrameTurn's deviceResolution), so it scales them
// by devicePixelRatio / r: UI text and chrome draw at the screen's own pixels above the backing's
// cap.
export function uiOverlayFit(
  devicePixelRatio: number,
  world: WorldCanvas,
): { readonly cssSize: Size; readonly projection: UiProjection } {
  const cssSize = {
    height: parseFloat(world.style.height) || world.clientHeight,
    width: parseFloat(world.style.width) || world.clientWidth,
  };
  return {
    cssSize,
    projection: uiProjection({
      captureSize: { height: world.height, width: world.width },
      cssSize,
      devicePixelRatio,
    }),
  };
}
