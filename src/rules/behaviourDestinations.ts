import { type Random, shuffled } from "@andornaut/game-kit/random";

import type { ObjectLayout, Point } from "../data/types";
import type { BehaviourWorld } from "./behaviourReach";
import { EDGE } from "./bird";

export function supportedDestinations(
  supported: (target: Point) => boolean,
  config: { readonly distance: number; readonly minMovement: number },
  object: ObjectLayout,
  world: BehaviourWorld,
  facing: -1 | 1,
  mode: "ground" | "fly",
  random: Random | undefined,
  at: Point,
): readonly Point[] {
  const bounds = world.traversalFrame!.bounds;
  const leash = object.behaviour!.pursuit!.distance;
  const positions: Point[] = [];
  for (const support of [
    ...world.solids,
    ...(world.platforms ?? []).filter(({ owner }) => owner !== object).map(({ rect }) => rect),
  ]) {
    const y = support.y - object.height;
    const dy = y - at.y;
    if (
      (mode === "ground" && Math.abs(dy) > config.distance) ||
      y < bounds.y ||
      y + object.height > bounds.y + bounds.height
    ) {
      continue;
    }
    const radius =
      mode === "fly" ? config.distance : Math.sqrt(Math.max(0, config.distance ** 2 - dy ** 2));
    const low = Math.max(support.x, bounds.x, object.origin.x - leash, at.x - radius);
    const high = Math.min(
      support.x + support.width - object.width,
      bounds.x + bounds.width - object.width,
      object.origin.x + leash,
      at.x + radius,
    );
    if (low > high) {
      continue;
    }
    const varied = random ? [low + random() * (high - low)] : [];
    for (const x of [
      ...varied,
      ...(facing === 1
        ? [low, high, Math.max(low, Math.min(high, at.x))]
        : [high, low, Math.max(low, Math.min(high, at.x))]),
    ]) {
      const target = { x, y };
      if (Math.abs(x - at.x) < config.minMovement || !supported(target)) {
        continue;
      }
      if (
        !positions.some((point) => Math.abs(point.x - x) <= EDGE && Math.abs(point.y - y) <= EDGE)
      ) {
        positions.push(target);
      }
    }
  }
  if (random) {
    return shuffled(random, positions);
  }
  return positions.sort((a, b) => {
    const side = (point: Point) => (Math.sign(point.x - at.x) === -facing ? 0 : 1);
    return (
      side(a) - side(b) ||
      Math.hypot(a.x - at.x, a.y - at.y) - Math.hypot(b.x - at.x, b.y - at.y) ||
      a.x - b.x ||
      a.y - b.y
    );
  });
}
