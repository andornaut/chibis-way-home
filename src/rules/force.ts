import { rectsOverlap } from "@andornaut/game-kit/rect";

import type { Point, Rect } from "../data/types";

export interface ForcePulse {
  readonly facing: -1 | 1;
  readonly height: number;
  readonly range: number;
  readonly remaining: number;
  readonly source: Rect;
  readonly start: number;
  readonly velocity: Point;
}

export function forcePulseVolume(pulse: ForcePulse): Rect {
  return {
    height: pulse.height,
    width: pulse.range,
    x: pulse.facing > 0 ? pulse.source.x + pulse.source.width : pulse.source.x - pulse.range,
    y: pulse.source.y + pulse.source.height - pulse.height,
  };
}

// Solids cast horizontal shadows across the overlap band. A partly exposed body still receives
// the push; only complete cover removes it. Callers exclude ledges from this solid context.
function exposed(solids: readonly Rect[], pulse: ForcePulse, target: Rect): boolean {
  const volume = forcePulseVolume(pulse);
  if (!rectsOverlap(volume, target)) {
    return false;
  }
  const edge = pulse.facing > 0 ? pulse.source.x + pulse.source.width : pulse.source.x;
  const near =
    pulse.facing > 0 ? Math.max(edge, target.x) : Math.min(edge, target.x + target.width);
  const left = Math.min(edge, near);
  const right = Math.max(edge, near);
  let visible: readonly (readonly [number, number])[] = [
    [Math.max(volume.y, target.y), Math.min(volume.y + volume.height, target.y + target.height)],
  ];
  for (const solid of solids) {
    if (solid.x >= right || solid.x + solid.width <= left) {
      continue;
    }
    visible = visible.flatMap(([top, bottom]): readonly (readonly [number, number])[] => {
      const cutTop = Math.max(top, solid.y);
      const cutBottom = Math.min(bottom, solid.y + solid.height);
      if (cutTop >= cutBottom) {
        return [[top, bottom]];
      }
      return [
        ...(cutTop > top ? [[top, cutTop] as const] : []),
        ...(cutBottom < bottom ? [[cutBottom, bottom] as const] : []),
      ];
    });
    if (visible.length === 0) {
      return false;
    }
  }
  return true;
}

// Average the active part of each finite gust over this fixed step. The returned velocity has
// no momentum and applies only while the current collision box is exposed inside the volume.
export function forcePulseVelocity(
  solids: readonly Rect[],
  seconds: number,
  pulses: readonly ForcePulse[],
  target: Rect,
): Point {
  const total = { x: 0, y: 0 };
  if (!(seconds > 0) || !Number.isFinite(seconds)) {
    return total;
  }
  for (const pulse of pulses) {
    const active = Math.min(seconds, pulse.start + pulse.remaining) - Math.max(0, pulse.start);
    if (
      !(active > 0) ||
      !(pulse.height > 0) ||
      !(pulse.range > 0) ||
      !exposed(solids, pulse, target)
    ) {
      continue;
    }
    total.x += (pulse.facing * pulse.velocity.x * active) / seconds;
    total.y += (pulse.velocity.y * active) / seconds;
  }
  return total;
}
