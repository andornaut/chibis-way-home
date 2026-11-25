import type { ArenaApproach, ArenaApproachPolicy, CertifiedPool } from "../../data/types/index.ts";

export function arenaApproachPolicyProblems(policy: ArenaApproachPolicy): string[] {
  const problems: string[] = [];
  if (policy.profile !== "cold-encounter-v1") {
    problems.push(`Unknown arena approach profile ${String(policy.profile)}`);
  }
  if (
    policy.predecessors.length !== 1 ||
    new Set(policy.predecessors).size !== policy.predecessors.length
  ) {
    problems.push("Arena approach profile requires exactly one qualified predecessor");
  }
  return problems;
}

// Qualification metadata stays out of runtime; a declared constraint still requires its relation.
export function arenaApproachProblems(
  context: {
    readonly arena: string | undefined;
    readonly eligible: readonly string[];
    readonly stage: string;
  },
  policy: ArenaApproachPolicy,
  relation: ArenaApproach | undefined,
): string[] {
  const problems = arenaApproachPolicyProblems(policy);
  if (context.arena === undefined) {
    problems.push("Arena approach requires an admitted arena");
  }
  for (const id of policy.predecessors) {
    if (!context.eligible.includes(id)) {
      problems.push(`Arena approach predecessor ${id} is not eligible`);
    }
  }
  if (
    relation === undefined ||
    relation.arena !== context.arena ||
    relation.stage !== context.stage ||
    relation.profile !== policy.profile ||
    relation.predecessors.length !== policy.predecessors.length ||
    relation.predecessors.some((id, index) => id !== policy.predecessors[index])
  ) {
    problems.push("Arena approach has no matching qualified relation");
  }
  return problems;
}

export function arenaApproachRelations(
  pools: readonly Pick<CertifiedPool, "approaches">[],
): Readonly<Record<string, ArenaApproach>> {
  const relations: Record<string, ArenaApproach> = {};
  for (const pool of pools) {
    for (const relation of pool.approaches ?? []) {
      if (Object.hasOwn(relations, relation.stage)) {
        throw new Error(`Repeated arena approach stage ${relation.stage}`);
      }
      relations[relation.stage] = relation;
    }
  }
  return relations;
}
