import type { ObjectLayout } from "../data/types";
import type { BehaviourState } from "../rules/behaviour";

export function behaviourPose(
  object: ObjectLayout,
  state: BehaviourState,
): { animation: string | undefined; flipX: boolean } {
  return {
    animation: state.active
      ? (object.behaviour?.states[state.stateKey]?.animation ?? undefined)
      : (object.behaviour?.inactiveAnimation ?? object.animations.idle),
    flipX: (state.axis ?? object.behaviour?.axis) === "x" && state.facing === -1,
  };
}
