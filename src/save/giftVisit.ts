import type { RoomPlan, ZoneMap } from "../data/types/index.ts";
import {
  type PreparedStageGift,
  prepareGift,
  type Progress,
  sameGiftVisit,
} from "../progress/index.ts";

export function createGiftVisitSave(
  map: ZoneMap,
  rooms: Readonly<Record<string, RoomPlan>>,
  ports: { readonly progress: () => Progress; readonly write: (progress: Progress) => void },
) {
  return {
    // Commit only after successful actual assembly, before movement is initialized.
    commitStageGift(prepared: PreparedStageGift): void {
      const checked = prepareGift(
        map,
        rooms,
        prepared.previousVisit,
        prepared.stage,
        prepared.visit.seed,
      );
      if (
        checked === undefined ||
        checked.giftRoom !== prepared.giftRoom ||
        !sameGiftVisit(checked.visit, prepared.visit)
      ) {
        throw new Error("Invalid prepared gift visit");
      }
      const progress = ports.progress();
      if (sameGiftVisit(progress.giftVisit, prepared.visit)) {
        return;
      }
      if (!sameGiftVisit(progress.giftVisit, prepared.previousVisit)) {
        throw new Error("Prepared gift visit is no longer current");
      }
      ports.write({ ...progress, activeSkill: null, giftVisit: prepared.visit, skills: [] });
    },
    // A proposed stage draw never writes or changes ownership and selection.
    prepareStageGift(stage: string, proposedSeed: number): PreparedStageGift | undefined {
      return prepareGift(map, rooms, ports.progress().giftVisit, stage, proposedSeed);
    },
  };
}
