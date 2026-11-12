import type { DialogueLine, StageBarkSchedule } from "../data/types/index.ts";

type OfferBark = (onStart: () => void, line: DialogueLine) => boolean;

// One generated stage run owns this state; retries retain it, fresh entries replace it.
export function createStageBarks(schedule: StageBarkSchedule, stage: string) {
  const events = schedule[stage] ?? [];
  const ids = new Set<string>();
  for (const event of events) {
    if (
      !event.id.trim() ||
      ids.has(event.id) ||
      !Number.isFinite(event.atProgress) ||
      event.atProgress < 0 ||
      event.atProgress > 1
    ) {
      throw new Error(`Invalid stage bark schedule for ${stage}`);
    }
    ids.add(event.id);
  }
  const heard = new Set<string>();
  return {
    offer(enqueue: OfferBark, progress: number): boolean {
      const event = events.find((event) => !heard.has(event.id) && progress >= event.atProgress);
      return event ? enqueue(() => heard.add(event.id), event.line) : false;
    },
  };
}
