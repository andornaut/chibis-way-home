import { expect, it } from "vitest";

import { SPEAKERS } from "../../data/dialogues.ts";
import { ZONE_MAP } from "../../data/map.ts";
import { STATS_BARKS } from "../../data/statsBarks.ts";
import { TEXT } from "../../data/text.ts";
import { dialogueParagraphs } from "./conversation.ts";
import { statsStatement } from "./statsStatement.ts";

it.each(["clear", "retry"] as const)(
  "maps each stage to its destination's %s statement",
  (kind) => {
    for (const zone of ZONE_MAP.destinations) {
      expect(statsStatement(kind, zone.stages.at(-1)!)).toEqual(
        dialogueParagraphs(SPEAKERS, TEXT, {
          lines: [STATS_BARKS[zone.id as keyof typeof STATS_BARKS][kind]],
        })[0],
      );
    }
  },
);

it("has no statement for an uncatalogued diagnostic stage", () => {
  expect(statsStatement("retry", "diagnostic-stage")).toBeUndefined();
});
