import { cameraScroll, groundLine } from "../camera";
import type { AreaLayout, CameraTuning, ObjectLayout, Size } from "../data/types";

interface BackgroundGroundContext {
  readonly area: Pick<AreaLayout, "chunks" | "entries" | "height" | "solids" | "width">;
  readonly camera: CameraTuning;
  readonly screen: Size;
}

export function backgroundGroundReference(context: BackgroundGroundContext, entryKey: string) {
  const { area, camera, screen } = context;
  const entry = area.entries[entryKey];
  if (!entry) {
    throw new Error(`No ground anchor entry ${entryKey}`);
  }
  const ground = groundLine(camera, screen, area, entry.x);
  return { ground, scroll: cameraScroll(camera, screen, area, { x: entry.x, y: ground }) };
}

// Anchor art's bottom to a stable entry-ground camera baseline, retaining authored row offsets.
export function backgroundGroundOffset(
  context: BackgroundGroundContext,
  object: Pick<ObjectLayout, "groundAnchor" | "height" | "parallax">,
): number {
  if (object.groundAnchor === undefined) {
    return 0;
  }
  const { ground, scroll } = backgroundGroundReference(context, object.groundAnchor);
  return ground - (1 - (object.parallax?.y ?? 1)) * scroll.y - object.height;
}
