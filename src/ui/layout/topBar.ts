import { START_SCREEN } from "../../data/layout.ts";
import type { Rect } from "../../data/types/index.ts";
import { hitAround } from "./hitAreas.ts";

export const TOP_BAR_CENTRE_Y = START_SCREEN.navHeight / 2;

// Centre the visible face above its bottom lip, keeping the full press target below the view's top.
export function topBarButton(bottomLip: number, art: Rect): { art: Rect; hit: Rect } {
  const placed = { ...art, y: TOP_BAR_CENTRE_Y - (art.height - bottomLip) / 2 };
  const hit = hitAround(placed);
  return { art: placed, hit: { ...hit, y: Math.max(0, TOP_BAR_CENTRE_Y - hit.height / 2) } };
}
