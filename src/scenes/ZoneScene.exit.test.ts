import { EventEmitter } from "node:events";

import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { ZONE_MAP } from "../data/map";

const save = vi.hoisted(() => ({
  completeStageRun: vi.fn(() => ({})),
  flushStats: vi.fn(),
  saveCompleted: vi.fn(),
  savedMap: vi.fn(() => ({ completed: [], stand: "unchanged" })),
  stageRunStats: vi.fn(() => ({})),
  wholeRunStats: vi.fn(() => ({})),
  zoneVisitStats: vi.fn(() => ({})),
}));
vi.mock("phaser", () => ({ Input: {}, Scale: {}, Scene: class {}, Scenes: {} }));
vi.mock("../ui/input/frameTurn", () => ({ FRAME_TURN: {} }));
vi.mock("../dev/mode", () => ({ isDevelopmentSession: () => false }));
vi.mock("./save", () => save);
vi.mock("../progress/save/runSummary", () => ({ wholeRunSummary: () => ({}) }));

import { ZoneScene } from "./ZoneScene";

beforeEach(() => vi.stubGlobal("window", { location: { search: "" } }));
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

it("finishes the exit fade before returning left directly to Map without completing or summarising", () => {
  const camera = Object.assign(new EventEmitter(), { fadeOut: vi.fn() });
  const route = { launch: vi.fn(), pause: vi.fn(), start: vi.fn() };
  const clearControls = vi.fn();
  const scene = Object.assign(new ZoneScene(), {
    cameras: { main: camera },
    clearControls,
    mapNode: ZONE_MAP.start,
    scene: route,
    zone: { turnedBack: true },
  }) as unknown as { fadeOut(): void; hold: string };
  scene.fadeOut();
  expect(scene.hold).toBe("fade");
  expect(camera.fadeOut).toHaveBeenCalledOnce();
  expect(route.start).not.toHaveBeenCalled();
  camera.emit("camerafadeoutcomplete");
  expect(clearControls).toHaveBeenCalledOnce();
  expect(save.flushStats).toHaveBeenCalledOnce();
  expect(route.start).toHaveBeenCalledExactlyOnceWith("map");
  expect(route.launch).not.toHaveBeenCalled();
  expect(route.pause).not.toHaveBeenCalled();
  for (const readOrWrite of [
    save.completeStageRun,
    save.saveCompleted,
    save.savedMap,
    save.stageRunStats,
    save.wholeRunStats,
    save.zoneVisitStats,
  ]) {
    expect(readOrWrite).not.toHaveBeenCalled();
  }
  camera.emit("camerafadeoutcomplete");
  expect(route.start).toHaveBeenCalledOnce();
});

it("retains completion and the departure summary when the final stage exits right", () => {
  const destination = ZONE_MAP.destinations[0]!;
  const stage = destination.stages.at(-1)!;
  const route = { launch: vi.fn(), pause: vi.fn(), start: vi.fn() };
  const scene = Object.assign(new ZoneScene(), {
    clearControls: vi.fn(),
    input: { enabled: true },
    mapNode: stage,
    scene: route,
    showTouchControls: vi.fn(),
    story: { outro: "outro", zone: destination.id },
    zone: { turnedBack: false },
  }) as unknown as { leave(): void };
  scene.leave();
  expect(save.completeStageRun).toHaveBeenCalledExactlyOnceWith(stage);
  expect(save.saveCompleted).toHaveBeenCalledExactlyOnceWith(stage);
  expect(route.launch).toHaveBeenCalledWith(
    "zoneDeparture",
    expect.objectContaining({ cleared: true, clearedStage: stage }),
  );
  expect(route.pause).toHaveBeenCalledOnce();
  expect(route.start).not.toHaveBeenCalled();
});
