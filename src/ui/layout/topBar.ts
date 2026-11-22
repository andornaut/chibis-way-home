import { START_SCREEN } from "../../data/layout.ts";
import type { Rect } from "../../data/types/index.ts";
import { hitAround } from "./hitAreas.ts";

export const TOP_BAR_CENTRE_Y = START_SCREEN.navHeight / 2;

export function topBarFaceY(bottomLip: number, height: number): number {
  return TOP_BAR_CENTRE_Y - (height - bottomLip) / 2;
}

// Centre the visible face above its bottom lip, keeping the full press target below the view's top.
export function topBarButton(bottomLip: number, art: Rect): { art: Rect; hit: Rect } {
  const placed = { ...art, y: topBarFaceY(bottomLip, art.height) };
  const hit = hitAround(placed);
  return { art: placed, hit: { ...hit, y: Math.max(0, TOP_BAR_CENTRE_Y - hit.height / 2) } };
}
