import { beforeEach, expect, it, vi } from "vitest";

const saved = vi.hoisted(() => ({
  progress: { at: "beginning" as "beginning" | "map", openingSeen: false },
}));
const gate = vi.hoisted(() => ({ accepts: vi.fn(() => true) }));
vi.mock("phaser", () => ({ Scene: class {} }));
vi.mock("../pwa", () => ({ coverZone: vi.fn() }));
vi.mock("./save", () => ({
  clearProgress: vi.fn(),
  resetWholeRunStats: vi.fn(),
  savedProgress: () => saved.progress,
}));
vi.mock("./modalInput", () => ({ modalInput: () => gate }));

import { startScreenLayout } from "../ui";
import { CelebrationScene } from "./CelebrationScene";
import { RestartScene } from "./RestartScene";
import { clearProgress, resetWholeRunStats } from "./save";
import { StartScene } from "./StartScene";

beforeEach(() => {
  vi.clearAllMocks();
  gate.accepts.mockReturnValue(true);
});

it.each([
  { kind: "start", make: () => new StartScene() },
  { kind: "celebration", make: () => new CelebrationScene() },
])("requires the Restart scene before $kind can clear anything", ({ kind, make }) => {
  const launch = vi.fn(),
    start = vi.fn();
  const scene = Object.assign(make(), {
    drawFocus: vi.fn(),
    render: vi.fn(),
    scene: { key: kind, launch, start },
  }) as unknown as { act(control: "restart"): void };
  scene.act("restart");
  expect(launch).toHaveBeenCalledExactlyOnceWith("restart", { opener: kind });
  expect(start).not.toHaveBeenCalled();
  expect(clearProgress).not.toHaveBeenCalled();
});

it("never defaults to clearing and commits a confirmed restart only once before scene shutdown", () => {
  const restartClosed = vi.fn(),
    start = vi.fn(),
    stop = vi.fn();
  const scene = Object.assign(new RestartScene(), {
    render: vi.fn(),
    scene: { get: () => ({ restartClosed }), start, stop },
    sys: { isActive: () => true },
  }) as unknown as Pick<RestartScene, "init" | "key">;
  const key = (value: string) =>
    scene.key({ key: value, repeat: false, shiftKey: false } as KeyboardEvent);
  scene.init({ opener: "start" });
  gate.accepts.mockReturnValue(false);
  key("Enter");
  gate.accepts.mockReturnValue(true);
  key("Enter");
  expect(clearProgress).not.toHaveBeenCalled();
  key("ArrowRight");
  key("Enter");
  expect(restartClosed).toHaveBeenCalledOnce();
  expect(clearProgress).not.toHaveBeenCalled();
  scene.init({ opener: "start" });
  key("ArrowRight");
  key("ArrowRight");
  key("Enter");
  key("Enter");
  expect(clearProgress).toHaveBeenCalledOnce();
  expect(resetWholeRunStats).toHaveBeenCalledOnce();
  expect(stop).toHaveBeenCalledWith("start");
  expect(start).toHaveBeenCalledExactlyOnceWith("opening");
});

it.each([
  { hasContinue: false, name: "Start with beginning progress", progress: "beginning" },
  { hasContinue: true, name: "Continue", progress: "map" },
  {
    hasContinue: true,
    name: "Continue context with beginning progress",
    progress: "beginning",
  },
] as const)("preserves saved totals for $name", ({ hasContinue, progress }) => {
  saved.progress = { at: progress, openingSeen: true };
  const start = vi.fn();
  const scene = Object.assign(new StartScene(), {
    layout: startScreenLayout({ height: 239, width: 558 }, false, hasContinue),
    scene: { start },
  }) as unknown as { act(control: "start"): void };
  scene.act("start");
  scene.act("start");
  expect(resetWholeRunStats).not.toHaveBeenCalled();
  expect(clearProgress).not.toHaveBeenCalled();
  expect(start).toHaveBeenCalledExactlyOnceWith("map");
});
