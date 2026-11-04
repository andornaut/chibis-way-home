import type { Ability, AbilityTable } from "../ai/ability";
import type { BehaviourMotion, ObjectLayout, Point } from "../data/types";
import type { BehaviourState } from "./behaviour";
import type { BehaviourPerception } from "./behaviourPerception";
import { trackReach, travelHeading } from "./behaviourTrack";

export interface BehaviourAbilityContext {
  readonly object: ObjectLayout;
  readonly perception: BehaviourPerception;
  // The slice decided so far; an ability may shorten it to its motion's next event.
  readonly slice: number;
  readonly track: { readonly axis: "x" | "y" };
}

export interface BehaviourActor {
  readonly at: Point;
  readonly state: BehaviourState;
}

export interface BehaviourMotionStep {
  readonly slice: number;
  readonly to: Point;
}

type BehaviourAbility<Motion extends BehaviourMotion> = Ability<
  BehaviourAbilityContext,
  Motion,
  BehaviourActor,
  BehaviourMotionStep
>;

// Bounded travel along the state's track at the motion's speed, stopping at the track end,
// solid terrain and other solid platforms. Target-relative travel stops level with Chibi.
const TRACK_TRAVEL: BehaviourAbility<Extract<BehaviourMotion, { readonly kind: "hop" | "move" }>> =
  {
    act: ({ object, perception, slice, track }, motion, { at, state }) => {
      if (motion.speed <= 0) {
        return { slice, to: at };
      }
      const direction = travelHeading(motion, state);
      let desired = at[track.axis] + direction * motion.speed * slice;
      if (motion.direction === "target") {
        const { target: bird, tuning } = perception;
        const target =
          bird[track.axis] +
          (track.axis === "x" ? tuning.width - object.width : tuning.height - object.height) / 2;
        desired = direction === 1 ? Math.min(desired, target) : Math.max(desired, target);
      }
      const end = trackReach(object, perception.world, at, state, direction, desired);
      const moving = Math.abs(end - at[track.axis]) / motion.speed;
      return moving > 0
        ? { slice: Math.min(slice, moving), to: { ...at, [track.axis]: end } }
        : { slice, to: at };
    },
  };

// Motion kinds without an entry still run inline in the executor.
export const BEHAVIOUR_ABILITIES: AbilityTable<
  BehaviourAbilityContext,
  BehaviourMotion,
  BehaviourActor,
  BehaviourMotionStep
> = { hop: TRACK_TRAVEL, move: TRACK_TRAVEL };
