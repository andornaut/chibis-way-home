import { clamp01 } from "@andornaut/game-kit/numbers";

import type { Point, Rect } from "../data/types";

export type TouchChromeKind = "jump" | "knob" | "move" | "use";
export type TouchChromePose = "held" | "held-left" | "held-right" | "press" | "rest";
export interface TouchChromeColours {
  readonly cream: number;
  readonly ink: number;
  readonly white: number;
}
export const TOUCH_CHROME_SCALE = 4;
export const TOUCH_CHROME_FRAME = 75;
export const TOUCH_KNOB_FRAME = 11;

export type TouchChromeLayer =
  | {
      readonly colour: number;
      readonly kind: "disc";
      readonly centre: Point;
      readonly radius: number;
    }
  | {
      readonly colour: number;
      readonly kind: "ring";
      readonly centre: Point;
      readonly inner: number;
      readonly outer: number;
    }
  | {
      readonly colour: number;
      readonly kind: "stroke";
      readonly path: readonly Point[];
      readonly width: number;
    }
  | { readonly colour: number; readonly kind: "rect"; readonly rect: Rect };

const CENTRE = { x: 37.5, y: 37.5 };
const JUMP = [
  { x: 28, y: 42 },
  { x: 37.5, y: 33 },
  { x: 47, y: 42 },
] as const;
const LEFT = [
  { x: 18, y: 34 },
  { x: 13, y: 37.5 },
  { x: 18, y: 41 },
] as const;
const RIGHT = LEFT.map(({ x, y }) => ({ x: TOUCH_CHROME_FRAME - x, y }));

export function touchChromeLayers(
  colours: TouchChromeColours,
  kind: TouchChromeKind,
  pose: TouchChromePose,
  expanded: boolean,
): readonly TouchChromeLayer[] {
  const layers: TouchChromeLayer[] = [];
  const lit = pose === "press" || pose === "held";
  const core = lit ? colours.white : colours.cream;
  const disc = (centre: Point, radius: number, colour: number) => {
    layers.push({ centre, colour: colours.ink, kind: "disc", radius: radius + 1 });
    layers.push({ centre, colour, kind: "disc", radius });
  };
  const stroke = (path: readonly Point[], width: number, colour: number) => {
    layers.push({ colour: colours.ink, kind: "stroke", path, width: width + 2 });
    layers.push({ colour, kind: "stroke", path, width });
  };
  if (kind === "knob") {
    disc({ x: 5.5, y: 5.5 }, 4.5, core);
    return layers;
  }
  const outer = 36.5 + (expanded ? 1 : 0);
  layers.push({ centre: CENTRE, colour: colours.ink, inner: outer - 5, kind: "ring", outer });
  layers.push({ centre: CENTRE, colour: core, inner: outer - 4, kind: "ring", outer: outer - 1 });
  if (kind === "use") {
    // Paint all dot halos before their cores, including the shared halo between adjacent dots.
    for (const x of [28.5, 37.5, 46.5]) {
      layers.push({ centre: { x, y: 37.5 }, colour: colours.ink, kind: "disc", radius: 5 });
    }
    for (const x of [28.5, 37.5, 46.5]) {
      layers.push({ centre: { x, y: 37.5 }, colour: core, kind: "disc", radius: 4 });
    }
  } else if (kind === "jump") {
    stroke(JUMP, 3, core);
  } else {
    stroke(LEFT, 4, pose === "held-left" ? colours.white : colours.cream);
    stroke(RIGHT, 4, pose === "held-right" ? colours.white : colours.cream);
  }
  return layers;
}

function segmentDistance(point: Point, from: Point, to: Point): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const t = clamp01(((point.x - from.x) * dx + (point.y - from.y) * dy) / (dx * dx + dy * dy));
  return Math.hypot(point.x - from.x - t * dx, point.y - from.y - t * dy);
}

// Coverage changes only within one high-resolution texel of each geometric boundary.
function coverage(distance: number): number {
  return clamp01(0.5 - distance * TOUCH_CHROME_SCALE);
}

export function touchChromePixel(
  layers: readonly TouchChromeLayer[],
  point: Point,
): readonly [number, number, number, number] {
  let alpha = 0;
  let red = 0;
  let green = 0;
  let blue = 0;
  for (const layer of layers) {
    let amount: number;
    if (layer.kind === "rect") {
      const { rect } = layer;
      amount =
        coverage(Math.max(rect.x - point.x, point.x - rect.x - rect.width)) *
        coverage(Math.max(rect.y - point.y, point.y - rect.y - rect.height));
    } else if (layer.kind === "stroke") {
      let distance = Infinity;
      for (let index = 1; index < layer.path.length; index++) {
        distance = Math.min(
          distance,
          segmentDistance(point, layer.path[index - 1]!, layer.path[index]!),
        );
      }
      amount = coverage(distance - layer.width / 2);
    } else {
      const distance = Math.hypot(point.x - layer.centre.x, point.y - layer.centre.y);
      amount =
        layer.kind === "disc"
          ? coverage(distance - layer.radius)
          : coverage(distance - layer.outer) - coverage(distance - layer.inner);
    }
    const remaining = 1 - amount;
    red = ((layer.colour >> 16) & 255) * amount + red * remaining;
    green = ((layer.colour >> 8) & 255) * amount + green * remaining;
    blue = (layer.colour & 255) * amount + blue * remaining;
    alpha = amount + alpha * remaining;
  }
  if (alpha === 0) {
    return [0, 0, 0, 0];
  }
  return [
    Math.round(red / alpha),
    Math.round(green / alpha),
    Math.round(blue / alpha),
    Math.round(alpha * 255),
  ];
}
