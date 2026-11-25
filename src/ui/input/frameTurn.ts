import {
  type FrameTurnWatch,
  watchFrameTurn,
} from "@andornaut/game-kit/runtime/web/view/dom/watchFrameTurn";

let watched: FrameTurnWatch | undefined;

// The game page's frame turn (the kit's web/view/dom/watchFrameTurn): the game is drawn for
// landscape, so on a touch screen in portrait the frame turns onto its side, by the kit's
// stylesheet that src/game.ts imports. src/game.ts starts the watch as the game module loads;
// its Phaser setup and the zone's touch mapping read it.
export function frameTurn(): FrameTurnWatch {
  watched ??= watchFrameTurn("landscape", window);
  return watched;
}
