import type { ZonePlan } from "../data/types/index.ts";

// The ids of plan's middle chunks: each area's placed chunks but its first and last, which are
// the stage's start and finish caps or a section's, in area order, each once.
export function middleChunkIds(plan: ZonePlan): readonly string[] {
  const order = plan.areaOrder ?? Object.keys(plan.areas);
  return [
    ...new Set(
      order.flatMap((area) =>
        (plan.areas[area]?.chunks ?? []).slice(1, -1).map(({ chunk }) => chunk),
      ),
    ),
  ];
}
