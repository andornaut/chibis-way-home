import { packAtlas } from "@andornaut/art-kit/atlasLayout";
import type { Point } from "@andornaut/game-kit/rect";

// Mobile GPUs guarantee textures up to 2048 pixels a side.
export const ATLAS_MAX_SIZE = 2048;
// Each image's edge pixels repeat this far outward, so a frame sampled just past its edge reads
// its own colour rather than a neighbour's.
export const EXTRUDE = 1;
const PAGE_WIDTHS = [256, 512, 1024, 2048] as const;

// An image to pack, by its key.
export interface PackItem {
  readonly height: number;
  readonly key: string;
  readonly width: number;
}

// Where an image's top-left sits, on which page.
export interface Placement extends Point {
  readonly key: string;
  readonly page: number;
}

export interface PageSize {
  readonly height: number;
  readonly width: number;
}

export interface AtlasLayout {
  readonly pages: readonly PageSize[];
  readonly placements: readonly Placement[];
}

// Packs whole images with the shared shelf solver, preserving local ordering and errors.
export function layoutAtlas(
  items: readonly PackItem[],
  maxSize: number = ATLAS_MAX_SIZE,
): AtlasLayout {
  const compare = (a: PackItem, b: PackItem) =>
    b.height - a.height || b.width - a.width || (a.key < b.key ? -1 : 1);
  const packed = packAtlas(
    {
      compare: (a, b) => compare(a.value, b.value),
      extrude: EXTRUDE,
      maxSize,
      widths: [...PAGE_WIDTHS.filter((candidate) => candidate < maxSize), maxSize],
    },
    items.map((item) => ({
      rectangles: [{ height: item.height, width: item.width }],
      value: item,
    })),
  );
  if (packed === undefined) {
    const largest = [...items]
      .sort(compare)
      .find(({ height, width }) => Math.max(width, height) + 2 * EXTRUDE > maxSize);
    throw new Error(`${largest?.key ?? "An image"} is too large for a ${maxSize} px atlas page`);
  }
  return {
    pages: packed.pages.map(({ height, width }) => ({ height, width })),
    placements: packed.pages.flatMap(({ placed }, page) =>
      placed.map(({ at, item }) => ({
        key: item.value.key,
        page,
        x: at[0]!.x,
        y: at[0]!.y,
      })),
    ),
  };
}
