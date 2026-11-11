import { SCREEN } from "../data/screen";
import type { Size } from "../data/types";

// A scale manager's sizes as followFrameTurn's deviceResolution sets them for a canvas css big
// at r device pixels per CSS pixel: the game size is the backing and the zoom is 1 / r.
export function deviceScale(css: Size, r = 1): { gameSize: Size; zoom: number } {
  return {
    gameSize: { height: Math.round(css.height * r), width: Math.round(css.width * r) },
    zoom: 1 / r,
  };
}

// A canvas fit to show the game's view at fit CSS pixels per base pixel, at r.
export function fitScale(fit: number, r = 1): { gameSize: Size; zoom: number } {
  return deviceScale({ height: SCREEN.height * fit, width: SCREEN.width * fit }, r);
}
