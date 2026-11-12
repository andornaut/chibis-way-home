import { type Cameras, Tilemaps } from "phaser";

type ViewCamera = Pick<
  Cameras.Scene2D.Camera,
  "height" | "scrollX" | "scrollY" | "width" | "zoomX" | "zoomY"
>;

type CullLayer = Pick<
  Tilemaps.TilemapLayer,
  "cullCallback" | "cullPaddingX" | "cullPaddingY" | "x" | "y"
>;

// A layer's cull: the tiles of data it draws for camera, into output.
export type TileCull = (
  data: Tilemaps.LayerData,
  camera: ViewCamera,
  output: Tilemaps.Tile[],
  renderOrder: number,
) => Tilemaps.Tile[];

export interface TileBounds {
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
}

// The columns and rows of a layer at (x, y) that camera shows, padded by paddingX columns and
// paddingY rows. Every camera zooms about its top-left (playCamera's keepViewport), so it shows
// scrollX to scrollX + width / zoomX across and scrollY to scrollY + height / zoomY down.
export function viewTileBounds(
  tile: number,
  padding: { readonly x: number; readonly y: number },
  layer: { readonly x: number; readonly y: number },
  camera: ViewCamera,
): TileBounds {
  const left = camera.scrollX - layer.x;
  const top = camera.scrollY - layer.y;
  return {
    bottom: Math.ceil((top + camera.height / camera.zoomY) / tile) + padding.y,
    left: Math.floor(left / tile) - padding.x,
    right: Math.ceil((left + camera.width / camera.zoomX) / tile) + padding.x,
    top: Math.floor(top / tile) - padding.y,
  };
}

// Culls layer's tiles to the view each camera shows (viewTileBounds). Phaser's own cull reads
// the camera's worldView, which assumes a zoom about the centre, so at any zoom above 1 it drops
// the tiles in the left and top of a top-left-origin view.
export function cullToView(tile: number, layer: CullLayer): void {
  const cull: TileCull = (data, camera, output, renderOrder) => {
    const bounds = viewTileBounds(
      tile,
      { x: layer.cullPaddingX, y: layer.cullPaddingY },
      layer,
      camera,
    );
    output.length = 0;
    return Tilemaps.Components.RunCull(data, bounds, renderOrder, output);
  };
  layer.cullCallback = cull;
}
