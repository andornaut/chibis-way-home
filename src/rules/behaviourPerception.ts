import type { BirdTuning } from "../data/types/index.ts";
import { type BehaviourGeometry, type BehaviourWorld, behaviourWorld } from "./behaviourReach.ts";
import type { BirdState } from "./bird.ts";

// What one behaviour-driven object perceives for one tick, built once before it decides. The
// graph, pursuit, intent, attack and motion steps read only this, the object's own layout and
// state, and the world's decision streams.
export interface BehaviourPerception {
  // Chibi's current state and the tuning that sizes his body.
  readonly target: BirdState;
  readonly tuning: BirdTuning;
  // Present terrain, platforms, hazards and chunks, the camera view, the traversal frame with
  // its support and crumbling predictions, the targeted-attack window and decision streams.
  readonly world: BehaviourWorld;
}

export function perceiveBehaviour(
  tuning: BirdTuning,
  geometry: BehaviourGeometry,
  target: BirdState,
): BehaviourPerception {
  return { target, tuning, world: behaviourWorld(geometry) };
}
