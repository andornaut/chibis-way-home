import { type Random, randomPick } from "@andornaut/game-kit/random";

import type { CharacterState, ObjectLayout, Point, Quirk } from "../data/types";

// The state a character's animation shows: react while she is within its reaction's range,
// move while it moved this frame, else idle.
export function characterState(
  object: ObjectLayout,
  moved: boolean,
  mine: Point,
  hers: Point,
): CharacterState {
  const { reaction } = object;
  if (reaction.kind !== "none" && Math.hypot(hers.x - mine.x, hers.y - mine.y) <= reaction.range) {
    return "react";
  }
  return moved ? "move" : "idle";
}

// When a quirk next plays, after a time: every seconds later, give or take its variance.
export function nextQuirkAt(random: Random, quirk: Quirk, after: number): number {
  return after + quirk.every * (1 + quirk.variance * (2 * random() - 1));
}

// One of a character's lines or quips, drawn from random, or undefined when it has none.
export function chooseWord(random: Random, keys: readonly string[]): string | undefined {
  return keys.length === 0 ? undefined : randomPick(random, keys);
}
