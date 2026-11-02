import { watchFrameTurn } from "../platform/view/frameTurn";

// The game page's frame turn (the kit's view/frameTurn): the game is drawn for landscape, so on a
// touch screen in portrait the frame turns onto its side, by the kit's stylesheet that
// src/main.ts imports. Read by src/main.ts's Phaser setup and the zone's touch mapping.
export const FRAME_TURN = watchFrameTurn(window, "landscape");
