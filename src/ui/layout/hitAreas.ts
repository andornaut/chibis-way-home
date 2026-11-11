import { clamp } from "@andornaut/game-kit/numbers";
import { containsPoint } from "@andornaut/game-kit/rect";

import { HIT_RULE } from "../../data/layout";
import type { Point, Rect } from "../../data/types";

// Every button's press area reaches past its drawn button on every side by HIT_RULE's margin,
// and is at least its minTarget on each side, grown evenly about the button's centre where it
// would be smaller. Jump's reaches on to the screen's right and bottom edges as well
// (touchControls.ts).

// How far a drawn button's press area reaches past it on every side.
export function hitMargin(art: Rect): number {
  const { leastMargin, marginShare, mostMargin } = HIT_RULE;
  return clamp(leastMargin, mostMargin, marginShare * Math.min(art.width, art.height));
}

// A drawn button's press area: art grown by hitMargin on every side, then to minTarget on each
// axis where it is still smaller, about its centre.
export function hitAround(art: Rect): Rect {
  const margin = hitMargin(art);
  const grow = (start: number, size: number) => {
    const grown = size + 2 * margin;
    const side = Math.max(grown, HIT_RULE.minTarget);
    return { size: side, start: start - margin - (side - grown) / 2 };
  };
  const x = grow(art.x, art.width);
  const y = grow(art.y, art.height);
  return { height: y.size, width: x.size, x: x.start, y: y.start };
}

// A circle, cut where awayFrom is given along the line midway between its centre and awayFrom:
// it then takes in only the points nearer its own centre, so two circles cut toward each other
// meet on that line and never overlap.
interface Circle {
  readonly awayFrom?: Point;
  readonly centre: Point;
  readonly radius: number;
}

// A press area's shape: a rect, a circle, or the union of several.
export type PressShape = Circle | Rect | readonly (Circle | Rect)[];

// A button on screen: what it is, where it is drawn, and its press area.
export interface PressArea<K> {
  readonly art: Rect;
  readonly hit: PressShape;
  readonly key: K;
}

function contains(shape: PressShape, point: Point): boolean {
  if (Array.isArray(shape)) {
    return shape.some((part: Circle | Rect) => contains(part, point));
  }
  if ("radius" in shape) {
    const fromCentre = Math.hypot(point.x - shape.centre.x, point.y - shape.centre.y);
    const { awayFrom } = shape;
    return (
      fromCentre < shape.radius &&
      (awayFrom === undefined ||
        fromCentre < Math.hypot(point.x - awayFrom.x, point.y - awayFrom.y))
    );
  }
  return containsPoint(shape as Rect, point.x, point.y);
}

function distanceToCentre(art: Rect, point: Point): number {
  return Math.hypot(point.x - (art.x + art.width / 2), point.y - (art.y + art.height / 2));
}

// The button a press at point lands on: of those whose press area takes it in, the one whose
// drawn button's centre is nearest, so where two areas overlap the nearer button wins.
export function pressedArea<K>(areas: readonly PressArea<K>[], point: Point): K | undefined {
  let best: PressArea<K> | undefined;
  for (const area of areas) {
    if (
      contains(area.hit, point) &&
      (best === undefined || distanceToCentre(area.art, point) < distanceToCentre(best.art, point))
    ) {
      best = area;
    }
  }
  return best?.key;
}
