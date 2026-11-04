import { readFileSync } from "node:fs";

import { type AsepriteSheet, sheetTags } from "@andornaut/game-kit/art/aseprite";
import { describe, expect, it } from "vitest";

import { CHARACTERS } from "../data/characters";
import { DIALOGUES, ZONE_DIALOGUES } from "../data/dialogues";
import { ZONE_MAP } from "../data/map";
import type { ZoneDialoguePlan } from "../data/types";
import { DESTINATION_FIXTURE as map } from "../testing/mapDestinations";
import { introductionForRun, zoneExitFlow, zoneStoryForStage } from "./zoneFlow";

const entry = {
  character: "test-actor",
  escapeTilesPerSecond: 12,
  idleAnimation: "idle",
  runAnimation: "walk",
};
const pairs = {
  first: { entry, intro: "first-intro", outro: "first-outro" },
  second: { entry, intro: "second-intro", outro: "second-outro" },
};

describe("zone story routing", () => {
  it("resolves every real introduction to an existing actor, manual conversation and animation tags", () => {
    for (const destination of ZONE_MAP.destinations) {
      const story = introductionForRun(
        ZONE_MAP,
        ZONE_DIALOGUES[destination.id]!.introStage ?? destination.stages[0]!,
        new Set(),
        zoneStoryForStage(ZONE_MAP, ZONE_DIALOGUES, destination.stages[0]!),
      )!;
      const profile = story.entry!;
      const actor = CHARACTERS[profile.character]!;
      const sheet = JSON.parse(
        readFileSync(
          new URL(`../../public/art/sprites/${actor.art}.json`, import.meta.url),
          "utf8",
        ),
      ) as AsepriteSheet;
      const tags = sheetTags(sheet);
      expect(tags.has(profile.idleAnimation), destination.id).toBe(true);
      expect(tags.has(profile.runAnimation), destination.id).toBe(true);
      expect(profile.escapeTilesPerSecond, destination.id).toBeGreaterThan(0);
      expect(DIALOGUES[story.intro]?.lines.length, destination.id).toBeGreaterThan(0);
      expect(DIALOGUES[story.intro]?.choice, destination.id).toBeUndefined();
    }
  });
  it("shares the physical introduction identity across destination stages", () => {
    const first = zoneStoryForStage(map, pairs, "one");
    const second = zoneStoryForStage(map, pairs, "two");
    expect(first).toEqual(second);
    expect(zoneStoryForStage(map, pairs, "debug")).toBeUndefined();
  });
  it("opens the physical introduction only on an unseen opening stage", () => {
    const story = zoneStoryForStage(map, pairs, "one");
    expect(introductionForRun(map, "one", new Set(), story)).toBe(story);
    expect(introductionForRun(map, "one", new Set(["first"]), story)).toBeUndefined();
    expect(introductionForRun(map, "two", new Set(), story)).toBeUndefined();
    expect(introductionForRun(map, "one", new Set(), undefined)).toBeUndefined();
    const missing = { ...story! };
    delete missing.entry;
    expect(() => introductionForRun(map, "one", new Set(), missing)).toThrow(
      "Missing entry introduction profile first",
    );
  });
  it.each<{ expected: string | undefined; name: string; plan: ZoneDialoguePlan; stage: string }>([
    { expected: "first", name: "default opening stage", plan: pairs.first, stage: "one" },
    {
      expected: "first",
      name: "explicit later stage",
      plan: { ...pairs.first, introStage: "two" },
      stage: "two",
    },
    {
      expected: undefined,
      name: "earlier unselected stage",
      plan: { ...pairs.first, introStage: "two" },
      stage: "one",
    },
    {
      expected: undefined,
      name: "later unselected stage",
      plan: { ...pairs.first, introStage: "one" },
      stage: "two",
    },
  ])("selects the $name without recording unseen introductions", ({ expected, plan, stage }) => {
    const story = zoneStoryForStage(map, { ...pairs, first: plan }, stage);
    const seen = new Set<string>();
    expect(introductionForRun(map, stage, seen, story)?.zone).toBe(expected);
    expect(seen.size).toBe(0);
    expect(introductionForRun(map, stage, new Set(["first"]), story)).toBeUndefined();
  });
  it.each(["three", "unknown", ""])(
    "rejects an introduction selector outside its destination: %j",
    (introStage) => {
      expect(() =>
        zoneStoryForStage(map, { ...pairs, first: { ...pairs.first, introStage } }, "one"),
      ).toThrow("outside destination first");
    },
  );
  it("still requires an entry profile on an explicitly selected later stage", () => {
    const story = {
      intro: "entry",
      introStage: "two",
      outro: "after",
      zone: "first",
    };
    expect(introductionForRun(map, "one", new Set(), story)).toBeUndefined();
    expect(() => introductionForRun(map, "two", new Set(), story)).toThrow(
      "Missing entry introduction profile first",
    );
  });
  it.each([
    { back: false, expected: { kind: "next-stage", stage: "two" }, stage: "one" },
    {
      back: true,
      expected: { kind: "departure", scene: "first-outro", target: { kind: "map" } },
      stage: "one",
    },
    {
      back: false,
      expected: {
        kind: "departure",
        scene: "first-outro",
        target: { kind: "map", travelTo: "three" },
      },
      stage: "two",
    },
    {
      back: false,
      expected: { kind: "departure", scene: "second-outro", target: { kind: "celebration" } },
      stage: "four",
    },
  ])(
    "routes $stage exit without an outro between intermediate stages",
    ({ back, expected, stage }) => {
      const story = zoneStoryForStage(map, pairs, stage)!;
      expect(
        zoneExitFlow(map, story, new Set(["one", "two", "three", "four"]), stage, back),
      ).toEqual(expected);
    },
  );
});
