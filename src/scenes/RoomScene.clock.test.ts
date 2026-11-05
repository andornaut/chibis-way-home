import { afterEach, expect, it, vi } from "vitest";

import { STEP_MS } from "../core";
import { ZONE_MAP } from "../data/map";

vi.mock("phaser", () => ({ Input: {}, Scale: {}, Scene: class {}, Scenes: {} }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

it("counts gift-room time once, equally in the attempt and in every total", async () => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
  const save = await import("./save");
  const { RoomScene } = await import("./RoomScene");
  await save.loadProgress();
  const stage = ZONE_MAP.start;
  const zone = ZONE_MAP.destinations[0]!.id;
  save.resetWholeRunStats();
  save.beginZoneVisit(zone);
  save.beginStageRun(stage);
  const room = new RoomScene() as unknown as {
    init(data: { room: string; stage: string }): void;
    update(time: number): void;
  };
  room.init({ room: "dash-gift", stage });
  const steps = 24;
  room.update(1000);
  room.update(1000 + steps * STEP_MS);
  const run = save.stageRunStats(stage);
  const seconds = run.attemptSeconds;
  expect(seconds).toBeCloseTo((steps * STEP_MS) / 1000, 9);
  expect({
    run: save.wholeRunStats().activeSeconds,
    stage: run.cumulativeSeconds,
    zone: save.zoneVisitStats(zone).cumulativeSeconds,
  }).toEqual({ run: seconds, stage: seconds, zone: seconds });
});
