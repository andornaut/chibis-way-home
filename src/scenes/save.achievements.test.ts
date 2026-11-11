import { afterEach, describe, expect, it, vi } from "vitest";

import { ZONE_MAP } from "../data/map";
import type { ZoneLayout } from "../data/types";
import type { BehaviourState } from "../rules/behaviour";
import type { ZoneState } from "../rules/zone";

const ACHIEVEMENTS_KEY = "chibis-way-home.achievements";
const LAYOUT = {
  areas: {
    main: { objects: [{ character: "dog-antagonist" }, { character: "pigeon-antagonist" }] },
  },
} as unknown as ZoneLayout;
const pursuit = (phase: "engaged" | "escaped") =>
  ({ pursuit: { phase, settled: false, unreachableSeconds: 0 } }) as BehaviourState;
const zone = (
  behaviours: readonly (BehaviourState | undefined)[],
  fields: Partial<ZoneState> = {},
): ZoneState =>
  ({
    area: "main",
    behaviours,
    bird: { airJumpUsed: false, dash: undefined },
    cleared: false,
    death: undefined,
    door: undefined,
    steps: 0,
    turnedBack: false,
    ...fields,
  }) as ZoneState;
const DEATH = {
  position: { x: 0, y: 0 },
  reason: "hazard",
  support: undefined,
  velocity: { x: 0, y: 0 },
} as unknown as ZoneState["death"];
const FIRST = ZONE_MAP.destinations[0]!;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

function storage(initial: readonly (readonly [string, string])[] = []): Map<string, string> {
  const values = new Map<string, string>(initial);
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
  return values;
}

async function settle(): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

const earned = (values: Map<string, string>) =>
  (JSON.parse(values.get(ACHIEVEMENTS_KEY) ?? '{"earned":[]}') as { earned: string[] }).earned;

describe("tracking achievements through the page save", () => {
  it("credits a boss escape once, but not on a death step, and queues one notice for it", async () => {
    const values = storage();
    const save = await import("./save");
    await save.loadProgress();
    const stage = FIRST.stages[0]!;
    save.beginStageRun(stage);
    const engaged = zone([pursuit("engaged"), pursuit("engaged")]);
    save.recordStepAchievements(
      LAYOUT,
      stage,
      engaged,
      zone([pursuit("escaped"), pursuit("escaped")], { death: DEATH }),
    );
    save.recordStepAchievements(
      LAYOUT,
      stage,
      engaged,
      zone([pursuit("escaped"), pursuit("engaged")]),
    );
    save.recordStepAchievements(
      LAYOUT,
      stage,
      engaged,
      zone([pursuit("escaped"), pursuit("engaged")]),
    );
    await settle();
    const notices = [
      save.nextAchievementNotice(() => true),
      save.nextAchievementNotice(() => false),
      save.nextAchievementNotice(() => false),
    ];
    await settle();
    expect({
      notices,
      stored: JSON.parse(values.get(ACHIEVEMENTS_KEY)!) as unknown,
    }).toEqual({
      notices: [undefined, "escape-archie", undefined],
      stored: { earned: ["escape-archie"], unannounced: [], version: 1 },
    });
  });

  it("earns a zone's clear, first try and no-death run in one visit, and keeps them on Restart", async () => {
    const values = storage();
    const save = await import("./save");
    await save.loadProgress();
    save.beginZoneVisit(FIRST.id);
    for (const stage of FIRST.stages) {
      save.beginStageRun(stage);
      save.completeStageRun(stage);
    }
    save.clearProgress();
    save.resetWholeRunStats();
    await settle();
    expect(
      save
        .achievementCard()
        .filter(({ earned }) => earned)
        .map(({ id }) => id),
    ).toEqual(["clear-blue-cityscape", "first-try-archie", "no-death-blue-cityscape"]);
    expect(earned(values)).toEqual([
      "clear-blue-cityscape",
      "first-try-archie",
      "no-death-blue-cityscape",
    ]);
  });

  it("shows the current visit's first tries on a locked no-death zone, reset by a retry", async () => {
    storage();
    const save = await import("./save");
    await save.loadProgress();
    save.beginZoneVisit(FIRST.id);
    save.beginStageRun(FIRST.stages[0]!);
    save.completeStageRun(FIRST.stages[0]!);
    const progress = () =>
      save.achievementCard().find(({ id }) => id === "no-death-blue-cityscape")?.progress;
    const cleared = progress();
    save.beginStageRun(FIRST.stages[1]!);
    save.retryStageRun(FIRST.stages[1]!);
    expect([cleared, progress()]).toEqual([
      { have: 1, need: 3 },
      { have: 0, need: 3 },
    ]);
  });

  it("earns all gift rooms with the third skill, and Speedy breaks the no-skill journey", async () => {
    const values = storage();
    const save = await import("./save");
    await save.loadProgress();
    const stage = FIRST.stages[0]!;
    save.beginStageRun(stage);
    save.grantSkill("dash");
    save.grantSkill("doubleJump");
    const beforeLast = earned(values);
    save.grantSkill("speedy");
    save.selectActiveSkill("speedy");
    save.beginStageRun(ZONE_MAP.finish);
    save.completeStageRun(ZONE_MAP.finish);
    await settle();
    expect({ after: earned(values), beforeLast }).toEqual({
      after: ["gift-rooms", "clear-apartment", "first-try-fert"],
      beforeLast: [],
    });
  });

  it("earns the no-skill journey only without a dash or air jump since Restart", async () => {
    const values = storage();
    const save = await import("./save");
    await save.loadProgress();
    const finish = ZONE_MAP.finish;
    save.beginStageRun(finish);
    save.recordStepAchievements(
      LAYOUT,
      finish,
      zone([]),
      zone([], { bird: { airJumpUsed: true, dash: undefined } as ZoneState["bird"] }),
    );
    save.retryStageRun(finish);
    save.completeStageRun(finish);
    save.clearProgress();
    save.resetWholeRunStats();
    save.beginStageRun(finish);
    save.retryStageRun(finish);
    save.completeStageRun(finish);
    await settle();
    expect(earned(values)).toEqual(["clear-apartment", "home-without-skills"]);
  });

  it("persists genuine achievements with run-only cheats active", async () => {
    const values = storage();
    const window = new EventTarget() as EventTarget & { location: URL };
    window.location = new URL("https://example.test/play/?devSession=1");
    Object.assign(window, {
      document: { fullscreenElement: null },
      matchMedia: () => ({ matches: false }),
      navigator: {},
    });
    vi.stubGlobal("window", window);
    const save = await import("./save");
    await save.loadProgress();
    save.beginZoneVisit(FIRST.id);
    for (const stage of FIRST.stages) {
      save.beginStageRun(stage);
      save.completeStageRun(stage);
    }
    save.recordStepAchievements(
      LAYOUT,
      FIRST.stages[0]!,
      zone([pursuit("engaged")]),
      zone([pursuit("escaped")]),
    );
    await settle();
    expect({
      card: save.achievementCard().some(({ earned: held }) => held),
      notice: save.nextAchievementNotice(() => false),
      stored: values.has(ACHIEVEMENTS_KEY),
    }).toEqual({ card: true, notice: expect.any(String), stored: true });
  });
});
