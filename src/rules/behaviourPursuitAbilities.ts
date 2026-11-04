import type { Ability } from "../ai/ability";
import type { Rect } from "../data/types";
import type { BehaviourState } from "./behaviour";
import type {
  BehaviourAbilityContext,
  BehaviourAbilityParams,
  BehaviourActor,
  BehaviourMotionStep,
} from "./behaviourAbilities";
import { flightAxis } from "./behaviourReach";
import { contactBox } from "./behaviourTrack";
import { birdBox } from "./bird";

type PursuitAbility<Kind extends BehaviourAbilityParams["kind"]> = Ability<
  BehaviourAbilityContext,
  Extract<BehaviourAbilityParams, { readonly kind: Kind }>,
  BehaviourActor,
  BehaviourMotionStep
>;

export interface PursuitAim {
  // The tracked rect: a held sampled intent or traversal goal, else Chibi's live body.
  readonly hers: Rect;
  readonly dx: number;
  readonly state: BehaviourState;
  readonly targetY: number;
  readonly travel: number;
}

// Chases only while engaged or still finishing an airborne traversal leg.
export function pursuing(state: BehaviourState): boolean {
  return (
    state.pursuit?.phase === "engaged" ||
    (state.traversal !== undefined && !state.traversal.physical.grounded)
  );
}

// The contact-centred chase target inside the pursuit leash, facing it unless a traversal
// takeoff is preparing.
export function pursuitAim(
  { intent, object, perception, slice }: BehaviourAbilityContext,
  speed: number,
  { at, state }: BehaviourActor,
): PursuitAim {
  const hers =
    intent.sampled && state.intent
      ? state.intent.target
      : intent.sampled && state.traversal
        ? state.traversal.target
        : birdBox(perception.tuning, perception.target);
  const contact = contactBox(object, at, state.facing, state.axis);
  const leash = object.behaviour!.pursuit!.distance;
  const targetX = Math.max(
    object.origin.x - leash,
    Math.min(
      object.origin.x + leash,
      hers.x + hers.width / 2 - contact.width / 2 - (contact.x - at.x),
    ),
  );
  const targetY = hers.y + hers.height / 2 - contact.height / 2 - (contact.y - at.y);
  const dx = targetX - at.x;
  return {
    dx,
    hers,
    state: {
      ...state,
      facing: state.traversal?.preparation
        ? state.facing
        : dx === 0
          ? state.facing
          : dx < 0
            ? -1
            : 1,
    },
    targetY,
    travel: speed * slice,
  };
}

// A held sampled intent keeps its own facing through the chase.
export function intentFacing(
  { intent }: BehaviourAbilityContext,
  state: BehaviourState,
): BehaviourState {
  return intent.sampled && state.intent ? { ...state, facing: state.intent.facing } : state;
}

// Direct flight towards the chase target, clipped by solid terrain; a sampled pause hovers.
export const AIR_CHASE: PursuitAbility<"air-chase"> = {
  act: (context, { motion }, actor) => {
    const { slice } = context;
    if (!pursuing(actor.state)) {
      return { slice, state: actor.state, to: actor.to };
    }
    const aim = pursuitAim(context, motion.speed, actor);
    let to = actor.to;
    if (!(context.intent.sampled && context.intent.paused)) {
      const { at } = actor;
      const { world } = context.perception;
      const dy = aim.targetY - at.y;
      const fraction = Math.min(1, aim.travel / (Math.hypot(aim.dx, dy) || 1));
      const x = flightAxis(context.object, world, at, "x", at.x + aim.dx * fraction);
      to = { x, y: flightAxis(context.object, world, { ...at, x }, "y", at.y + dy * fraction) };
    }
    return { slice, state: intentFacing(context, aim.state), to };
  },
};
