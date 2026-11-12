import { EventEmitter } from "node:events";

import { describe, expect, it, vi } from "vitest";

import { CUTSCENE_CONTINUE, DIALOGUE_SCREEN, statsStatement } from "../ui/index.ts";

vi.mock("phaser", () => ({
  Scene: class {
    readonly add = { rectangle: () => ({ setOrigin: vi.fn() }) };
    readonly events = new EventEmitter();
    readonly game = {};
    readonly input = Object.assign(new EventEmitter(), {
      keyboard: new EventEmitter(),
      stopPropagation: vi.fn(),
    });
    readonly scene = { get: vi.fn(), start: vi.fn(), stop: vi.fn() };
  },
}));
const statementRect = vi.hoisted(() => ({ height: 14, width: 480, x: 120, y: 260 }));
vi.mock("../ui/dialogue/statsStatement.ts", () => ({
  statsStatement: vi.fn(() => ({
    colour: "tan",
    name: "Speaker",
    portrait: null,
    side: "right",
    text: "One statement",
  })),
}));
vi.mock("./runStatsParts.ts", () => ({
  addStageSummary: vi.fn((_scene: unknown, _bounds: unknown, data: { statement?: unknown }) => ({
    statement: data.statement ? { rect: statementRect } : undefined,
  })),
}));
vi.mock("./cardParts.ts", () => ({
  PRIMARY_BUTTON: {},
  addTextButton: vi.fn(),
  captureTab: vi.fn(),
  pressTextButton: vi.fn(),
  ringFocus: vi.fn(),
}));
vi.mock("./playCamera.ts", () => ({
  fitPlayCamera: vi.fn(),
  playPoint: (_scene: unknown, pointer: { x: number; y: number }) => pointer,
}));

import { CutsceneScene } from "./CutsceneScene.ts";
import { addStageSummary } from "./runStatsParts.ts";
import { ZoneDepartureScene } from "./ZoneDepartureScene.ts";

function cutscene() {
  const scene = new CutsceneScene();
  scene.init({
    clearedStage: "cleared-stage",
    percent: 1,
    runStats: { attemptSeconds: 65, attempts: 2, bestSeconds: 65, runSeconds: 120 },
    stage: "next-stage",
    wholeRun: { activeSeconds: 185, completed: 1, deaths: 1, total: 21 },
    zoneStats: {
      attemptSeconds: 65,
      attempts: 2,
      bestSeconds: undefined,
      completed: 1,
      partial: true,
      runSeconds: 120,
      total: 3,
    },
  });
  scene.create();
  return scene;
}

function key(scene: CutsceneScene, key: string, repeat = false) {
  scene.input.keyboard!.emit("keydown", { key, repeat, shiftKey: false, stopPropagation: vi.fn() });
}

describe("required inter-stage cutscene", () => {
  it("rejects dismissal and held activation, then continues exactly once to the supplied stage", () => {
    const scene = cutscene();
    for (const name of ["Escape", "p", "BrowserBack"]) {
      key(scene, name);
    }
    key(scene, "Enter", true);
    const oldPanel = {
      id: 2,
      wasCanceled: false,
      x: DIALOGUE_SCREEN.box.x + 1,
      y: DIALOGUE_SCREEN.box.y + 1,
    };
    scene.input.emit("pointerdown", oldPanel);
    scene.input.emit("pointerup", oldPanel);
    expect(scene.scene.start).not.toHaveBeenCalled();
    key(scene, "Enter");
    key(scene, " ");
    expect(scene.scene.start).toHaveBeenCalledExactlyOnceWith("zone", {
      continueVisit: true,
      node: "next-stage",
    });
  });

  it.each([
    { name: "Continue", rect: CUTSCENE_CONTINUE.button },
    { name: "statement line", rect: statementRect },
  ])("requires a fresh undragged $name tap", ({ rect: button }) => {
    const scene = cutscene();
    const pointer = { id: 1, wasCanceled: false, x: button.x + button.width / 2, y: button.y + 1 };
    scene.input.emit("pointerup", pointer);
    scene.input.emit("pointerdown", { ...pointer, x: 0, y: 0 });
    scene.input.emit("pointerup", pointer);
    scene.input.emit("pointerdown", pointer);
    scene.input.emit("pointermove", { ...pointer, x: 0 });
    scene.input.emit("pointerup", pointer);
    expect(scene.scene.start).not.toHaveBeenCalled();
    scene.input.emit("pointerdown", pointer);
    scene.input.emit("pointerup", pointer);
    expect(scene.scene.start).toHaveBeenCalledExactlyOnceWith("zone", {
      continueVisit: true,
      node: "next-stage",
    });
  });
});

it("draws the current clear statement once per entry, never on focus or resume", () => {
  vi.mocked(statsStatement).mockClear();
  const scene = cutscene();
  key(scene, "Tab");
  key(scene, "ArrowRight");
  scene.events.emit("resume");
  expect(statsStatement).toHaveBeenCalledExactlyOnceWith("clear", "cleared-stage");
  expect(vi.mocked(addStageSummary).mock.lastCall?.[2]).toMatchObject({
    percent: 1,
    stage: "cleared-stage",
    wholeRun: { activeSeconds: 185, completed: 1, deaths: 1, total: 21 },
    zoneStats: { completed: 1 },
  });
});
it("keeps final-zone Continue on the existing opener continuation without an exchange", () => {
  const scene = new ZoneDepartureScene();
  const opener = { dialogueClosed: vi.fn() };
  vi.mocked(scene.scene.get).mockReturnValue(opener as never);
  scene.init({
    clearedStage: "cleared-stage",
    percent: 1,
    runStats: { attemptSeconds: 1, attempts: 1, bestSeconds: 1, runSeconds: 1 },
    stage: "unused-next",
    wholeRun: { activeSeconds: 185, completed: 1, deaths: 1, total: 21 },
    zoneStats: {
      attemptSeconds: 1,
      attempts: 1,
      bestSeconds: 1,
      completed: 3,
      partial: false,
      runSeconds: 1,
      total: 3,
    },
  });
  scene.create();
  key(scene, "Enter");
  key(scene, "Enter");
  expect(scene.scene.stop).toHaveBeenCalledOnce();
  expect(opener.dialogueClosed).toHaveBeenCalledOnce();
  expect(scene.scene.start).not.toHaveBeenCalled();
});

it("preserves a turned-back summary without claiming a clear or inventing a statement", () => {
  vi.mocked(statsStatement).mockClear();
  const scene = new ZoneDepartureScene();
  scene.init({
    cleared: false,
    clearedStage: "cleared-stage",
    percent: 0.37,
    runStats: { attemptSeconds: 1, attempts: 1, bestSeconds: undefined, runSeconds: 1 },
    stage: "unused-next",
    wholeRun: { activeSeconds: 185, completed: 1, deaths: 1, total: 21 },
    zoneStats: {
      attemptSeconds: 1,
      attempts: 1,
      bestSeconds: undefined,
      completed: 0,
      partial: true,
      runSeconds: 1,
      total: 3,
    },
  });
  scene.create();
  expect(statsStatement).not.toHaveBeenCalled();
  expect(vi.mocked(addStageSummary).mock.lastCall?.[2]).toMatchObject({
    percent: 0.37,
    stage: "cleared-stage",
  });
});
