import { SPEAKERS } from "../../data/dialogues.ts";
import { ZONE_MAP } from "../../data/map.ts";
import { STATS_BARKS } from "../../data/statsBarks.ts";
import { TEXT } from "../../data/text.ts";
import { dialogueParagraphs } from "./conversation.ts";

export function statsStatement(kind: "clear" | "retry", stage: string) {
  const destination = ZONE_MAP.destinations.find((zone) => zone.stages.includes(stage));
  if (!destination) {
    return undefined;
  }
  const entry = STATS_BARKS[destination.id as keyof typeof STATS_BARKS][kind];
  return dialogueParagraphs(SPEAKERS, TEXT, { lines: [entry] })[0]!;
}
