import { describe, expect, it } from "vitest";

import {
  destinationForStage,
  destinationSelection,
  isLastZone,
  openMap,
  stageCompletion,
} from "../progress";
import { ZONE_MAP } from "./map";
import { TEXT } from "./text";
import { RECIPES, ZONES } from "./zones";

const CATALOGUE = ZONE_MAP.destinations.flatMap(({ stages }) => stages);
const PLANS = new Set([...Object.keys(ZONES), ...Object.keys(RECIPES)]);

describe("ZONE_MAP", () => {
  it("names every stage and destination and assigns each stage exactly once", () => {
    const stages = ZONE_MAP.nodes.filter((node) => node.kind === "zone").map((node) => node.id);
    expect(new Set(CATALOGUE).size).toBe(CATALOGUE.length);
    expect([...CATALOGUE].sort()).toEqual([...stages].sort());
    expect(stages.every((id) => Boolean(TEXT.map.stages[id]))).toBe(true);
    expect(ZONE_MAP.destinations.every(({ id }) => Boolean(TEXT.map.zones[id]))).toBe(true);
  });

  it("opens only the first stage initially and still presents its chooser", () => {
    const open = openMap(ZONE_MAP, new Set());
    expect(open.zones).toEqual([ZONE_MAP.start]);
    for (const destination of ZONE_MAP.destinations) {
      expect(destinationSelection(PLANS, ZONE_MAP, open, destination)).toEqual(
        destination.stages.includes(ZONE_MAP.start)
          ? { kind: "choose", latest: ZONE_MAP.start, stages: [ZONE_MAP.start] }
          : { kind: "unavailable" },
      );
    }
    expect(
      destinationSelection(
        new Set(),
        ZONE_MAP,
        open,
        destinationForStage(ZONE_MAP, ZONE_MAP.start),
      ),
    ).toEqual({ kind: "unavailable" });
  });

  it.each([1, ZONE_MAP.destinations[0]!.stages.length, CATALOGUE.length - 1])(
    "preserves replay and unlocks only the next built stage after %i clears",
    (count) => {
      const completed = new Set(CATALOGUE.slice(0, count));
      const open = openMap(ZONE_MAP, completed);
      expect(open.zones).toEqual(CATALOGUE.slice(0, count + 1));
      const latest = CATALOGUE[count]!;
      const destination = destinationForStage(ZONE_MAP, latest);
      expect(destinationSelection(PLANS, ZONE_MAP, open, destination)).toEqual({
        kind: "choose",
        latest,
        stages: destination.stages.filter((stage) => CATALOGUE.indexOf(stage) <= count),
      });
      for (const id of open.zones) {
        const node = ZONE_MAP.nodes.find((item) => item.id === id)!;
        expect(node.zone !== undefined && PLANS.has(node.zone)).toBe(true);
      }
    },
  );

  it("celebrates only the final catalogue stage", () => {
    const completed = new Set(CATALOGUE);
    expect(ZONE_MAP.destinations.at(-1)?.stages.at(-1)).toBe(ZONE_MAP.finish);
    for (const stage of CATALOGUE) {
      expect(isLastZone(ZONE_MAP, stage)).toBe(stage === ZONE_MAP.finish);
      expect(stageCompletion(ZONE_MAP, completed, stage).kind === "celebration").toBe(
        stage === ZONE_MAP.finish,
      );
    }
  });
});
