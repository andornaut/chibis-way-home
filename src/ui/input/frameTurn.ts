import { watchFrameTurn } from "@andornaut/game-kit/web/view/dom/watchFrameTurn";

// The game page's frame turn (the kit's web/view/dom/watchFrameTurn): the game is drawn for landscape, so on a
// touch screen in portrait the frame turns onto its side, by the kit's stylesheet that
// src/main.ts imports. Read by src/main.ts's Phaser setup and the zone's touch mapping.
export const FRAME_TURN = watchFrameTurn("landscape", window);
