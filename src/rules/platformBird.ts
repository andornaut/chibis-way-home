import { rectsOverlap } from "@andornaut/game-kit/rect";

import { collisionCandidates, EDGE } from "../core/index.ts";
import type { BirdTuning, ObjectLayout, Rect } from "../data/types/index.ts";
import { birdBox, type BirdState } from "./bird.ts";

interface PlatformBirdFrame {
  readonly after: Rect;
  readonly before: Rect;
  readonly object: ObjectLayout;
}

interface PlatformBirdPreparation {
  readonly bird: BirdState;
  readonly crushed: boolean;
  readonly dx: number;
  readonly riding: PlatformBirdFrame | undefined;
}

// Whether his feet are on top of rect.
export function standsOn(tuning: BirdTuning, bird: BirdState, rect: Rect): boolean {
  return (
    Math.abs(bird.y + tuning.height - rect.y) < EDGE &&
    bird.x < rect.x + rect.width &&
    bird.x + tuning.width > rect.x
  );
}

// Moves him with the platform he rides, by (dx, dy), along each axis only as far as no solid
// is in the way.
function ride(
  tuning: BirdTuning,
  solids: readonly Rect[],
  dx: number,
  dy: number,
  bird: BirdState,
): BirdState {
  const clear = (x: number, y: number) =>
    !collisionCandidates(solids, { ...birdBox(tuning, bird), x, y }).some((solid) =>
      rectsOverlap({ ...birdBox(tuning, bird), x, y }, solid),
    );
  const x = clear(bird.x + dx, bird.y) ? bird.x + dx : bird.x;
  const y = clear(x, bird.y + dy) ? bird.y + dy : bird.y;
  return { ...bird, x, y };
}

// A solid moving along x into his side pushes him out of its way, to the side he was on before
// it moved: its leading edge, as it runs into him. One that has not moved along x leaves him to
// the bird's own collision, which stops him by his own motion.
function pushedAside(tuning: BirdTuning, before: Rect, after: Rect, bird: BirdState): BirdState {
  if (after.x === before.x || !rectsOverlap(birdBox(tuning, bird), after)) {
    return bird;
  }
  const left = bird.x + tuning.width / 2 < before.x + before.width / 2;
  return { ...bird, x: left ? after.x - tuning.width : after.x + after.width };
}

export function preparePlatformBird(
  tuning: BirdTuning,
  terrainSolids: readonly Rect[],
  solids: readonly Rect[],
  platforms: readonly PlatformBirdFrame[],
  incoming: BirdState,
): PlatformBirdPreparation {
  const riding = platforms.find(({ before }) => standsOn(tuning, incoming, before));
  let bird = incoming;
  let dx = 0;
  if (riding) {
    dx = riding.after.x - riding.before.x;
    bird = ride(tuning, terrainSolids, dx, riding.after.y - riding.before.y, bird);
  }
  for (const { after, before } of platforms) {
    const feet = bird.y + tuning.height;
    if (feet <= before.y + EDGE && feet > after.y && rectsOverlap(birdBox(tuning, bird), after)) {
      bird = { ...bird, y: after.y - tuning.height };
    }
  }
  let crushed = false;
  for (const { after, before, object } of platforms) {
    const pushed = object.collision === "solid" ? pushedAside(tuning, before, after, bird) : bird;
    if (pushed !== bird) {
      bird = pushed;
      crushed ||= solids.some((solid) => rectsOverlap(birdBox(tuning, bird), solid));
    }
  }
  return { bird, crushed, dx, riding };
}

export function finishPlatformBird(
  seconds: number,
  prepared: PlatformBirdPreparation,
  bird: BirdState,
): BirdState {
  return prepared.riding && !bird.grounded ? { ...bird, carryVx: prepared.dx / seconds } : bird;
}
