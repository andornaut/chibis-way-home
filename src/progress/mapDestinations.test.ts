import { encodeSave, loadSave } from "@andornaut/game-kit/save/versionedSave";
import { describe, expect, it } from "vitest";

import {
  DESTINATION_FIXTURE as MAP,
  DESTINATION_PLAN_RECORD as PLANS,
  DESTINATION_PLANS as AVAILABLE,
} from "../testing/mapDestinations";
import { openMap } from "./map";
import {
  destinationForStage,
  destinationSelection,
  destinationStages,
  steppedDestination,
} from "./mapDestinations";
import { progressFormat } from "./save/progress";

describe("destination selection", () => {
  it.each([
    { completed: [], id: "first", kind: "choose", latest: "one" },
    { completed: ["one"], id: "first", kind: "choose", latest: "two" },
    { completed: ["one", "two"], id: "second", kind: "choose", latest: "three" },
    { completed: ["one", "two", "three"], id: "second", kind: "choose", latest: "four" },
    { completed: [], id: "second", kind: "unavailable", latest: undefined },
  ])("$id with $completed produces $kind", ({ completed, id, kind, latest }) => {
    const destination = MAP.destinations.find((item) => item.id === id)!;
    const result = destinationSelection(
      AVAILABLE,
      MAP,
      openMap(MAP, new Set(completed)),
      destination,
    );
    expect(result.kind).toBe(kind);
    expect(result.kind === "choose" ? result.latest : undefined).toBe(latest);
  });

  it("never treats an unbuilt plan as playable just because its stage node and name exist", () => {
    const first = MAP.destinations[0]!;
    const open = openMap(MAP, new Set(["one"]));
    expect(destinationStages(new Set(["one"]), MAP, open, first)).toEqual(["one"]);
    expect(destinationSelection(new Set(["one"]), MAP, open, first)).toEqual({
      kind: "choose",
      latest: "one",
      stages: ["one"],
    });
  });

  it("preserves stage-two unlock and latest highlight while replaying stage one", () => {
    const progress = {
      activeSkill: null,
      at: "map" as const,
      completed: ["one"],
      openingSeen: true,
      seenZoneIntros: [],
      skills: [],
      stand: "one",
    };
    const format = progressFormat(MAP, PLANS);
    const encoded = encodeSave(format, progress);
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) {
      return;
    }
    const loaded = loadSave(format, encoded.value).save;
    expect(loaded).toEqual(progress);
    if (loaded.at !== "map") {
      throw new Error("Expected saved map progress");
    }
    const result = destinationSelection(
      AVAILABLE,
      MAP,
      openMap(MAP, new Set(loaded.completed)),
      destinationForStage(MAP, loaded.stand),
    );
    expect(result).toEqual({ kind: "choose", latest: "two", stages: ["one", "two"] });
  });

  it("steps between only unlocked destinations", () => {
    expect(steppedDestination(AVAILABLE, MAP, openMap(MAP, new Set()), "one", 1)).toBe("first");
    expect(
      steppedDestination(AVAILABLE, MAP, openMap(MAP, new Set(["one", "two"])), "one", 1),
    ).toBe("second");
  });
});
