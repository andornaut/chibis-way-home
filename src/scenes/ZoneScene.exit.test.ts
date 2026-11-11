import { EventEmitter } from "node:events";

import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { DIALOGUES, ZONE_DIALOGUES } from "../data/dialogues";
import { ZONE_MAP } from "../data/map";
import { stageExit } from "../progress";
import { zoneStoryForStage } from "../rules/zoneFlow";

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
vi.mock("../dev/mode", () => ({ isDevelopmentSession: () => true }));
vi.mock("./save", () => save);
vi.mock("../progress/save/runSummary", () => ({ wholeRunSummary: () => ({}) }));

import { type DialogueData, DialogueScene } from "./DialogueScene";
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

// Leave a zone's final stage after clearing it, with its outgoing exchange shown by an actual
// DialogueScene opened by the launch.
function depart(stage: string) {
  const route = { launch: vi.fn(), pause: vi.fn(), start: vi.fn() };
  const story = zoneStoryForStage(ZONE_MAP, ZONE_DIALOGUES, stage)!;
  const zone = Object.assign(new ZoneScene(), {
    clearControls: vi.fn(),
    input: { enabled: true },
    loading: false,
    mapNode: stage,
    scene: route,
    showTouchControls: vi.fn(),
    story,
    zone: { turnedBack: false },
  }) as unknown as Pick<ZoneScene, "conversationCovers" | "dialogueClosed"> & { leave(): void };
  zone.leave();
  const [, data] = route.launch.mock.lastCall as [string, DialogueData];
  const dialogue = Object.assign(new DialogueScene(), {
    scene: { get: () => zone, stop: vi.fn() },
  });
  dialogue.init(data);
  const lines = dialogue as unknown as {
    act(action: "advance" | "skip"): void;
    drawParagraph(): void;
  };
  const drawParagraph = vi.spyOn(lines, "drawParagraph").mockImplementation(() => {});
  return { drawParagraph, lines, outro: story.outro, route, zone };
}

const ORDINARY = ZONE_MAP.destinations[0]!.stages.at(-1)!;
const PENTHOUSE = ZONE_MAP.destinations.at(-1)!.stages.at(-1)!;

it.each([
  { continuation: "map", stage: ORDINARY },
  { continuation: "celebration", stage: PENTHOUSE },
])(
  "saves the clear, then shows $stage's outgoing exchange, its statistics and the $continuation",
  ({ continuation, stage }) => {
    const target = stageExit(ZONE_MAP, new Set(), stage, false);
    expect(target.kind).toBe(continuation);
    const { drawParagraph, lines, outro, route, zone } = depart(stage);
    expect(route.launch).toHaveBeenCalledExactlyOnceWith("dialogue", {
      clearedStage: stage,
      scene: outro,
    });
    expect(route.pause).toHaveBeenCalledOnce();
    expect(save.saveCompleted).toHaveBeenCalledExactlyOnceWith(stage);
    expect(save.saveCompleted.mock.invocationCallOrder[0]).toBeLessThan(
      route.launch.mock.invocationCallOrder[0]!,
    );
    expect(zone.conversationCovers()).toBe(true);
    for (let line = 0; line < DIALOGUES[outro]!.lines.length; line++) {
      expect(route.launch).toHaveBeenCalledOnce();
      lines.act("advance");
    }
    expect(drawParagraph).toHaveBeenCalledTimes(DIALOGUES[outro]!.lines.length - 1);
    expect(route.launch).toHaveBeenLastCalledWith(
      "zoneDeparture",
      expect.objectContaining({ cleared: true, clearedStage: stage, percent: 1, stage }),
    );
    expect(zone.conversationCovers()).toBe(true);
    expect(route.start).not.toHaveBeenCalled();
    // The statistics' Continue closes them through the same opener.
    zone.dialogueClosed();
    if (target.kind === "map") {
      expect(route.start).toHaveBeenCalledExactlyOnceWith("map", { travelTo: target.travelTo });
    } else {
      expect(route.start).toHaveBeenCalledExactlyOnceWith("celebration");
    }
    expect(route.launch).toHaveBeenCalledTimes(2);
  },
);

it("skips the rest of the outgoing exchange straight to the statistics", () => {
  const { drawParagraph, lines, route } = depart(ORDINARY);
  lines.act("skip");
  expect(drawParagraph).not.toHaveBeenCalled();
  expect(route.launch).toHaveBeenLastCalledWith(
    "zoneDeparture",
    expect.objectContaining({ clearedStage: ORDINARY }),
  );
  expect(route.start).not.toHaveBeenCalled();
});
