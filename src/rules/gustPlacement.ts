import type { BehaviourPlan, Character, Instance } from "../data/types/index.ts";
import { ENCOUNTER_ROLES } from "./modules.ts";

// An instance's behaviour: its own, else its character's.
const behaviourOf = (
  characters: Readonly<Record<string, Character>>,
  instance: Instance,
): BehaviourPlan | undefined => instance.behaviour ?? characters[instance.character]?.behaviour;

// Whether a behaviour is a gust emitter's: some state carries a gustPhase.
export function gustEmitter(plan: BehaviourPlan | undefined): boolean {
  return Object.values(plan?.states ?? {}).some((node) => node.gustPhase !== undefined);
}

// Why a chunk or module's gusts break the placement rules, if they do: a chunk holding a gust
// emitter has no encounter, no encounter-role object and no pursuing boss, so gusts never stack
// with a boss's attacks; and every emitter faces left, against the left-to-right route.
export function gustPlacementProblems(
  characters: Readonly<Record<string, Character>>,
  chunk: { readonly encounters: number; readonly objects: readonly Instance[] },
): string[] {
  const emitters = chunk.objects.filter((instance) =>
    gustEmitter(behaviourOf(characters, instance)),
  );
  if (emitters.length === 0) {
    return [];
  }
  const problems: string[] = [];
  if (chunk.encounters !== 0) {
    problems.push(`gusts with ${chunk.encounters} encounters`);
  }
  for (const instance of chunk.objects) {
    if (instance.role !== undefined && ENCOUNTER_ROLES.has(instance.role)) {
      problems.push(`gusts beside ${instance.role} ${instance.character}`);
    } else if (behaviourOf(characters, instance)?.pursuit) {
      problems.push(`gusts beside pursuing ${instance.character}`);
    }
  }
  for (const instance of emitters) {
    if (behaviourOf(characters, instance)!.facing !== -1) {
      problems.push(`${instance.character} at col ${instance.col} does not blow against the route`);
    }
  }
  return problems;
}
