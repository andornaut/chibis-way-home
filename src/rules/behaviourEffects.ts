import { type Ability, abilityFor, type AbilityTable } from "../ai/ability";
import type { BehaviourAction, ObjectLayout } from "../data/types";
import type { BehaviourEvent } from "./behaviour";
import { contactBox } from "./behaviourTrack";
import type { SpawnEvent } from "./transients";
import type { ZonePulse } from "./zone";

// What one entry action emits into the zone: a force pulse to number, or a transient to spawn.
export type BehaviourEffect =
  | { readonly kind: "pulse"; readonly pulse: Omit<ZonePulse, "id"> }
  | { readonly kind: "spawn"; readonly spawn: SpawnEvent };

export interface BehaviourEffectContext {
  // The emitting object's index in its area.
  readonly emitter: number;
  readonly object: ObjectLayout;
}

type EffectAbility<Kind extends BehaviourAction["kind"]> = Ability<
  BehaviourEffectContext,
  Extract<BehaviourAction, { readonly kind: Kind }>,
  BehaviourEvent,
  BehaviourEffect
>;

// A finite push volume from the emitter's contact box, active for its duration from the event.
const FORCE_PULSE: EffectAbility<"force-pulse"> = {
  act: ({ object }, action, event) => ({
    kind: "pulse",
    pulse: {
      ...(action.visual && { visual: { ...action.visual, actor: object, at: event.at } }),
      facing: event.facing,
      height: action.height,
      range: action.range,
      remaining: action.seconds,
      source: contactBox(object, event.at, event.facing, event.axis),
      start: event.time,
      velocity: action.velocity,
    },
  }),
};

// A transient from the emitter's own spawn template, such as a thrown parcel or a dropped shot.
const SPAWN: EffectAbility<"spawn"> = {
  act: ({ emitter, object }, action, event) => {
    const template = object.spawnTemplates?.[action.character];
    if (!template) {
      throw new Error(`No spawn template ${action.character}`);
    }
    return { kind: "spawn", spawn: { ...event, emitter, emitterWidth: object.width, template } };
  },
};

export const BEHAVIOUR_EFFECTS: AbilityTable<
  BehaviourEffectContext,
  BehaviourAction,
  BehaviourEvent,
  BehaviourEffect
> = { "force-pulse": FORCE_PULSE, spawn: SPAWN };

export function behaviourEffect(
  context: BehaviourEffectContext,
  event: BehaviourEvent,
): BehaviourEffect {
  const ability = abilityFor(BEHAVIOUR_EFFECTS, event.action);
  if (!ability) {
    throw new Error(`No effect for ${event.action.kind}`);
  }
  return ability.act(context, event.action, event);
}
