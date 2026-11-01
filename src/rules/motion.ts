import { easeProgress, progressAt } from "@andornaut/game-kit/motion";
import { clamp01, lerp } from "@andornaut/game-kit/numbers";
import type { Random } from "@andornaut/game-kit/random";

import type { Direction, Motion, Point } from "../data/types";

// Where a moving object is relative to where it was placed, in the units of its motion (tiles in
// a plan, pixels in a layout), at a time since its area was entered.
export interface Track {
  at(seconds: number): Point;
}

const AXES: Readonly<Record<Direction, Point>> = {
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
};

// The unit step along a direction, y growing downward.
export function axisOf(direction: Direction): Point {
  return AXES[direction];
}

// One leg: travel from `from` to `to` (distances along the axis) in travel seconds, then wait
// pause seconds at `to`.
interface Leg {
  readonly from: number;
  readonly pause: number;
  readonly to: number;
  readonly travel: number;
}

// Shared kinematic lift for a complete hop, including its ground endpoints.
export function hopLift(height: number, duration: number, elapsed: number): number {
  const fraction = clamp01(duration > 0 ? elapsed / duration : 0);
  return height * 4 * fraction * (1 - fraction);
}

function pointOn(motion: Motion, leg: Leg, sinceStart: number): Point {
  const axis = axisOf(motion.direction);
  const f = progressAt(0, leg.travel, sinceStart);
  const eased = easeProgress(motion.algorithm === "ease" ? "sineInOut" : "linear", f);
  const along = lerp(leg.from, leg.to, eased);
  const lift = motion.algorithm === "hop" ? hopLift(motion.hopHeight, leg.travel, sinceStart) : 0;
  return { x: axis.x * along, y: axis.y * along - lift };
}

// A factor of 1 give or take up to variance, drawn from random.
function varied(random: Random, variance: number): number {
  return 1 + variance * (2 * random() - 1);
}

// The legs a motion makes, in order. linear, ease and hop go out to the far end and back, each leg
// of the same length and speed unless variance varies them; wander goes to a random point between
// the start and the far end on each leg.
function nextLeg(motion: Motion, random: Random, from: number, index: number): Leg {
  const vary = () => (motion.variance > 0 ? varied(random, motion.variance) : 1);
  let to: number;
  if (motion.algorithm === "wander") {
    to = random() * motion.distance;
  } else if (index % 2 === 0) {
    to = motion.distance * vary();
  } else {
    to = 0;
  }
  const speed = motion.speed * vary();
  return {
    from,
    pause: motion.pause * vary(),
    to,
    travel: speed > 0 ? Math.abs(to - from) / speed : 0,
  };
}

// A motion's track from phase (0 to 1) of its nominal round trip: 0 at the start heading out,
// 0.5 at the far end heading back. Without randomness (no variance, not wander) it is a pure
// function of time; otherwise random draws its legs, so the same random gives the same track.
export function motionTrack(motion: Motion, phase: number, random: Random): Track {
  if (motion.algorithm === "static" || motion.distance === 0 || motion.speed === 0) {
    return { at: () => ({ x: 0, y: 0 }) };
  }
  const travel = motion.distance / motion.speed;
  const trip = 2 * (travel + motion.pause);
  const offset = phase * trip;
  if (motion.variance === 0 && motion.algorithm !== "wander") {
    const out: Leg = { from: 0, pause: motion.pause, to: motion.distance, travel };
    const back: Leg = { from: motion.distance, pause: motion.pause, to: 0, travel };
    return {
      at(seconds) {
        const at = (((offset + seconds) % trip) + trip) % trip;
        const half = travel + motion.pause;
        return at < half ? pointOn(motion, out, at) : pointOn(motion, back, at - half);
      },
    };
  }
  // Legs are drawn as time reaches them and kept, so asking again gives the same answer.
  const legs: { readonly leg: Leg; readonly start: number }[] = [];
  let end = 0;
  const extendTo = (time: number) => {
    while (end <= time) {
      const last = legs.at(-1);
      const leg = nextLeg(motion, random, last ? last.leg.to : 0, legs.length);
      legs.push({ leg, start: end });
      end += Math.max(leg.travel + leg.pause, 1e-3);
    }
  };
  return {
    at(seconds) {
      const time = Math.max(0, offset + seconds);
      extendTo(time);
      let low = 0;
      let high = legs.length - 1;
      while (low < high) {
        const middle = Math.ceil((low + high) / 2);
        if ((legs[middle]?.start ?? 0) <= time) {
          low = middle;
        } else {
          high = middle - 1;
        }
      }
      const found = legs[low];
      return found ? pointOn(motion, found.leg, time - found.start) : { x: 0, y: 0 };
    },
  };
}
