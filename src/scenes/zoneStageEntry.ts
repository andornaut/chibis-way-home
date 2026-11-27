import { ZONE_MAP } from "../data/map.ts";
import type { ZonePlan } from "../data/types/index.ts";
import { RECIPES } from "../data/zones.ts";
import {
  planStage,
  requirePlanned,
  SEED_LIMIT,
  STAGE_CONTEXT,
  type StageEntry,
  type StageEntryContext,
} from "../rules/stage/index.ts";
import { commitStageGift, prepareStageGift, recentStageChunks } from "./save.ts";

// Rules stay seeded; the scene supplies entropy.
export function newSeed(): number {
  return Math.floor(Math.random() * SEED_LIMIT);
}

export const SCENE_ENTRY: StageEntryContext = {
  entropy: newSeed,
  map: ZONE_MAP,
  recent: (stage) => recentStageChunks(stage),
  recipes: Object.keys(RECIPES),
};

// Preview and backdrop plans keep canonical fills without changing the saved gift visit.
// Actual catalogue entries, including run links, commit only after successful resolution.
export function loadStageEntry<Layout>(
  resolve: (plan: ZonePlan) => Layout,
  entry: StageEntry,
  stage: string,
) {
  const gift =
    entry.mode === "preview" || entry.mode === "backdrop"
      ? undefined
      : prepareStageGift(stage, newSeed());
  const { middle, plan } = requirePlanned(
    planStage(
      STAGE_CONTEXT,
      gift === undefined ? entry.request : { ...entry.request, giftRoom: gift.giftRoom },
    ),
  );
  const layout = resolve(plan);
  if (gift !== undefined) {
    commitStageGift(gift);
  }
  return { giftRoom: gift?.giftRoom ?? undefined, layout, middle };
}
