import type { ArtManifest } from "../assets";
import type { Point, Size } from "../data/types";
import { drawsFrom, type Tileset } from "../stage";

// How an object's art is drawn: tiles from its area's tileset; a backdrop piece, placed once or
// repeated across the object's width; an animated sprite; or a flat placeholder rectangle, for
// art named placeholder-* or art the game does not have.
export type ArtKind = "backdrop" | "placeholder" | "repeated-backdrop" | "sprite" | "tiles";

// Ordinary sprites stay at world speed; validated scenery sprites use sceneryParallax.
export function artScrollFactor(kind: ArtKind, parallax?: Point): Point {
  const factors = parallax ?? { x: 1, y: 1 };
  if ((factors.x !== 1 || factors.y !== 1) && kind !== "backdrop" && kind !== "repeated-backdrop") {
    throw new Error(`Parallax requires backdrop art, not ${kind}`);
  }
  return factors;
}

export function artKind(manifest: ArtManifest, tileset: Tileset | undefined, art: string): ArtKind {
  if (art.startsWith("placeholder-")) {
    return "placeholder";
  }
  if (tileset && drawsFrom(tileset, art)) {
    return "tiles";
  }
  const backdrop = manifest.backdrops.find(({ key }) => key === art);
  if (backdrop) {
    return backdrop.repeat === "x" ? "repeated-backdrop" : "backdrop";
  }
  return manifest.sprites.some(({ key }) => key === art) ? "sprite" : "placeholder";
}

// Where art of a size is drawn for an object's rectangle, as an offset from its top-left corner:
// standing on its bottom edge, centred along x for a sprite and from its left edge for a backdrop.
export function artOffset(kind: ArtKind, rect: Size, art: Size): Point {
  return {
    x: kind === "sprite" ? Math.round((rect.width - art.width) / 2) : 0,
    y: rect.height - art.height,
  };
}
