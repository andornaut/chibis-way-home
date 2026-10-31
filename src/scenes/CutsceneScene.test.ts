import { EventEmitter } from "node:events";

import { describe, expect, it, vi } from "vitest";

import { CUTSCENE_CONTINUE } from "../layout/cutscene";

vi.mock("phaser", () => ({
  Scene: class {
    readonly add = { rectangle: () => ({ setOrigin: vi.fn() }) };
    readonly events = new EventEmitter();
    readonly game = {};
    readonly input = Object.assign(new EventEmitter(), {
      keyboard: new EventEmitter(),
      stopPropagation: vi.fn(),
    });
    readonly scene = { start: vi.fn() };
  },
}));
vi.mock("./runStatsParts", () => ({ addStageSummary: vi.fn() }));
vi.mock("./cardParts", () => ({
  PRIMARY_BUTTON: {},
  addTextButton: vi.fn(),
  captureTab: vi.fn(),
  pressTextButton: vi.fn(),
  ringFocus: vi.fn(),
}));
vi.mock("./playCamera", () => ({
  fitPlayCamera: vi.fn(),
  playPoint: (_scene: unknown, pointer: { x: number; y: number }) => pointer,
}));

import { CutsceneScene } from "./CutsceneScene";

function cutscene() {
  const scene = new CutsceneScene();
  scene.init({
    clearedStage: "cleared-stage",
    runStats: { attemptSeconds: 65, attempts: 2, bestSeconds: 65, runSeconds: 120 },
    stage: "next-stage",
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
    expect(scene.scene.start).not.toHaveBeenCalled();
    key(scene, "Enter");
    key(scene, " ");
    expect(scene.scene.start).toHaveBeenCalledExactlyOnceWith("zone", {
      continueVisit: true,
      node: "next-stage",
    });
  });

  it("requires a fresh undragged tap on Continue rather than an inherited release or outside tap", () => {
    const scene = cutscene();
    const { button } = CUTSCENE_CONTINUE;
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
