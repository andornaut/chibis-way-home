import type { StageBarkSchedule } from "./types/index.ts";

// Fert's journey bark line for each stage; the event ID repeats the line key.
const STAGE_BARK_LINES: Readonly<Record<string, string>> = {
  "back-streets": "fert-journey-back-streets",
  "city-boundary": "fert-journey-city-boundary",
  "city-streets": "fert-journey-city-streets",
  "country-lanes": "fert-journey-country-lanes",
  "deep-woods": "fert-journey-deep-woods",
  "familiar-neighbourhood": "fert-journey-familiar-neighbourhood",
  "freight-terminal": "fert-journey-freight-terminal",
  "loading-yards": "fert-journey-loading-yards",
  ravine: "fert-journey-ravine",
  "residential-floors": "fert-journey-residential-floors",
  restaurant: "fert-journey-restaurant",
  "river-crossing": "fert-journey-river-crossing",
};

export const STAGE_BARKS: StageBarkSchedule = Object.fromEntries(
  Object.entries(STAGE_BARK_LINES).map(([stage, line]) => [
    stage,
    [{ atProgress: 0.5, id: line, line: { line, speaker: "ferret" } }],
  ]),
);
