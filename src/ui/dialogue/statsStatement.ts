import { SPEAKERS } from "../../data/dialogues";
import { ZONE_MAP } from "../../data/map";
import { STATS_BARKS } from "../../data/statsBarks";
import { TEXT } from "../../data/text";
import { dialogueParagraphs } from "./conversation";

export function statsStatement(kind: "clear" | "retry", stage: string) {
  const destination = ZONE_MAP.destinations.find((zone) => zone.stages.includes(stage));
  if (!destination) {
    return undefined;
  }
  const entry = STATS_BARKS[destination.id as keyof typeof STATS_BARKS][kind];
  return dialogueParagraphs(SPEAKERS, TEXT, { lines: [entry] })[0]!;
}
