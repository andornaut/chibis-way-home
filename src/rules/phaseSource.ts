import type { Instance, ObjectLayout } from "../data/types";
import { effectiveHazardPhase } from "./effectiveCollision";

// Points each phase follower at its source's index among the area's placed objects. A follower is
// inert scenery with no clock of its own, its source a timed hazard, and its phaseAnimations name
// a tag for every one of the source's states.
export function resolvePhaseSources(
  instances: readonly Instance[],
  objects: readonly ObjectLayout[],
): readonly ObjectLayout[] {
  const ids = new Map(
    instances.flatMap((instance, index) =>
      instance.id === undefined ? [] : [[instance.id, index] as const],
    ),
  );
  return objects.map((object, index) => {
    const id = instances[index]!.phaseSource;
    if (id === undefined) {
      if (object.phaseAnimations) {
        throw new Error(`Phase animations on ${object.character} require a phase source`);
      }
      return object;
    }
    const source = ids.get(id);
    const plan = source === undefined ? undefined : objects[source]?.behaviour;
    if (
      source === undefined ||
      !plan ||
      effectiveHazardPhase(objects[source]!, undefined) === undefined
    ) {
      throw new Error(`Phase source ${id} of ${object.character} is not a placed timed hazard`);
    }
    if (
      object.collision !== "none" ||
      object.behaviour ||
      object.orbit ||
      object.contact ||
      object.motion.algorithm !== "static" ||
      object.reaction.kind !== "none" ||
      object.interaction.kind !== "none"
    ) {
      throw new Error(`Phase follower ${object.character} must be inert scenery`);
    }
    const missing = Object.keys(plan.states).filter((key) => !object.phaseAnimations?.[key]);
    if (missing.length > 0) {
      throw new Error(`Phase follower ${object.character} has no tag for ${missing.join(", ")}`);
    }
    return { ...object, phaseSource: source };
  });
}

// The tag a phase follower shows while its source is in a state, the source's initial state
// before its behaviour starts.
export function phaseFollowerTag(
  source: ObjectLayout,
  state: { readonly stateKey: string } | undefined,
  follower: ObjectLayout,
): string {
  const key = state?.stateKey ?? source.behaviour!.initial;
  const tag = follower.phaseAnimations?.[key];
  if (tag === undefined) {
    throw new Error(`Phase follower ${follower.character} has no tag for ${key}`);
  }
  return tag;
}
