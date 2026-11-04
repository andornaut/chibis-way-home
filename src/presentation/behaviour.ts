import type { ObjectLayout } from "../data/types";
import type { BehaviourState } from "../rules/behaviour";

export function behaviourPose(
  object: ObjectLayout,
  state: BehaviourState,
): { animation: string | undefined; flipX: boolean } {
  const key = state.idleWatchdog?.recovery
    ? object.behaviour!.idleWatchdog!.resume
    : state.stateKey;
  return {
    animation: state.active
      ? (state.animationTag ?? object.behaviour?.states[key]?.animation ?? undefined)
      : (object.behaviour?.inactiveAnimation ?? object.animations.idle),
    flipX: (state.axis ?? object.behaviour?.axis) === "x" && state.facing === -1,
  };
}
