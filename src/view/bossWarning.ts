import type { BossWarningTuning } from "../data/bossWarning";
import type { PixelRun, SpriteContact } from "../data/types";
import type { BehaviourState } from "../rules/behaviour";

export type { BossWarningTuning } from "../data/bossWarning";

interface Outline {
  readonly ink: readonly PixelRun[];
  readonly red: readonly PixelRun[];
}

const OUTLINES = new WeakMap<SpriteContact, Map<string, Outline>>();

function outline(tuning: BossWarningTuning, contact: SpriteContact, frame: string): Outline {
  let cached = OUTLINES.get(contact);
  if (!cached) {
    cached = new Map();
    OUTLINES.set(contact, cached);
  }
  const key = JSON.stringify([frame, tuning.strokeWidth, tuning.inkWidth]);
  const previous = cached.get(key);
  if (previous) {
    return previous;
  }
  const runs = contact.frames[frame];
  if (!runs) {
    throw new Error(`Missing warning silhouette frame ${frame}`);
  }
  if (
    ![tuning.strokeWidth, tuning.inkWidth].every(
      (width) => Number.isSafeInteger(width) && width > 0,
    )
  ) {
    throw new Error("Warning outline widths must be positive pixel counts");
  }
  const radius = tuning.strokeWidth + tuning.inkWidth;
  const padding = radius + 1;
  const width = contact.frame.width + 2 * padding;
  const height = contact.frame.height + 2 * padding;
  const occupied = new Uint8Array(width * height);
  for (const [y, left, right] of runs) {
    for (let x = left; x < right; x++) {
      occupied[(y + padding) * width + x + padding] = 1;
    }
  }

  // Only exterior transparency receives an outline; enclosed holes retain their original pixels.
  const exterior = new Uint8Array(occupied.length);
  const flood = [0];
  exterior[0] = 1;
  for (let next = 0; next < flood.length; next++) {
    const at = flood[next]!;
    const x = at % width;
    const y = Math.floor(at / width);
    for (const [nx, ny] of [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ]) {
      if (nx! < 0 || nx! >= width || ny! < 0 || ny! >= height) {
        continue;
      }
      const neighbour = ny! * width + nx!;
      if (!occupied[neighbour] && !exterior[neighbour]) {
        exterior[neighbour] = 1;
        flood.push(neighbour);
      }
    }
  }
  const distance = new Uint16Array(occupied.length);
  const queue: number[] = [];
  for (let at = 0; at < occupied.length; at++) {
    if (occupied[at]) {
      queue.push(at);
    }
  }
  for (let next = 0; next < queue.length; next++) {
    const at = queue[next]!;
    if (distance[at]! >= radius) {
      continue;
    }
    const x = at % width;
    const y = Math.floor(at / width);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
          continue;
        }
        const neighbour = ny * width + nx;
        if (!exterior[neighbour] || distance[neighbour]) {
          continue;
        }
        distance[neighbour] = distance[at]! + 1;
        queue.push(neighbour);
      }
    }
  }
  const ink: PixelRun[] = [];
  const red: PixelRun[] = [];
  for (let y = 0; y < height; y++) {
    let left = 0;
    while (left < width) {
      const value = distance[y * width + left]!;
      if (!value) {
        left++;
        continue;
      }
      const band = value <= tuning.strokeWidth ? red : ink;
      let right = left + 1;
      while (right < width) {
        const next = distance[y * width + right]!;
        if (!next || next <= tuning.strokeWidth !== (band === red)) {
          break;
        }
        right++;
      }
      band.push([y - padding, left - padding, right - padding]);
      left = right;
    }
  }
  const result = { ink, red };
  cached.set(key, result);
  return result;
}

export function bossWarning(
  tuning: BossWarningTuning,
  state: Pick<BehaviourState, "active" | "activeAttack" | "traversal"> | undefined,
  contact: SpriteContact | undefined,
  frame: string,
): Outline | undefined {
  if (
    !state?.active ||
    (state.activeAttack?.phase !== "tell" && !state.traversal?.preparation) ||
    !contact
  ) {
    return undefined;
  }
  return outline(tuning, contact, frame);
}
