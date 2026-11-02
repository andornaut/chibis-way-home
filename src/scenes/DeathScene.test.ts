import { EventEmitter } from "node:events";

import { fillNames } from "@andornaut/game-kit/lines";
import { expect, it, vi } from "vitest";

const face = { height: 48, width: 136, x: 364, y: 242 };
vi.mock("phaser", () => ({
  Scene: class {
    readonly cameras = { main: {} };
    readonly events = new EventEmitter();
    readonly game = {};
    readonly input = Object.assign(new EventEmitter(), {
      keyboard: new EventEmitter(),
      stopPropagation: vi.fn(),
    });
    readonly scene = { get: vi.fn(), stop: vi.fn() };
  },
}));
vi.mock("../view/statsStatement", () => ({
  statsStatement: vi.fn(() => ({ name: "Speaker", text: "One statement" })),
}));
vi.mock("../layout/deathCard", () => ({
  deathCard: vi.fn(() => ({
    card: { height: 252, width: 360, x: 180, y: 54 },
    home: { button: { ...face, x: 220 }, hit: { ...face, x: 220 } },
    progress: {},
    retry: { button: face, hit: face },
    stage: {},
    stageText: "Stage",
    statement: { rect: {}, text: "One statement" },
    stats: [],
    title: {},
    titleText: "Zone",
  })),
}));
vi.mock("./cardParts", () => ({
  BODY_FONT: "body",
  PRIMARY_BUTTON: {},
  TITLE_FONT: "title",
  addCardTextIn: vi.fn(() => ({ setLeftAlign: vi.fn(), setRightAlign: vi.fn() })),
  addSlice: vi.fn(),
  addTextButton: vi.fn(),
  captureTab: vi.fn(),
  cardFonts: vi.fn(),
  paletteColour: vi.fn(),
  pressTextButton: vi.fn(),
  ringFocus: vi.fn(),
}));
vi.mock("./modalBackdrop", () => ({ showModalBackdrop: vi.fn() }));
vi.mock("./modalTaps", () => ({ catchModalTaps: vi.fn() }));
vi.mock("./playCamera", () => ({
  fitPlayCamera: vi.fn(),
  playPoint: (_scene: unknown, point: unknown) => point,
}));
import { STATS_SCOPE_TEXT, TEXT } from "../data/text";
import { deathCard } from "../layout/deathCard";
import { statsStatement } from "../view/statsStatement";
import { DeathScene } from "./DeathScene";

it("selects the retry statement once per entry and keeps retry an explicit action", () => {
  const scene = new DeathScene();
  const opener = { leaveDeath: vi.fn(), retryDeath: vi.fn() };
  vi.mocked(scene.scene.get).mockReturnValue(opener as never);
  scene.init({
    activeSeconds: 1,
    percent: 0.5,
    runStats: { attemptSeconds: 65, attempts: 2, bestSeconds: 45, runSeconds: 130 },
    stage: "street",
    stageLabel: "Streets",
    stageNumber: "1",
    totals: { runSeconds: 610, stageSeconds: 130, zoneSeconds: 290 },
    zoneLabel: "City",
  });
  scene.create();
  expect(vi.mocked(deathCard).mock.lastCall?.[2].stats).toEqual([
    { label: fillNames(TEXT.stats.attempts, { count: "" }).trimEnd(), value: "2" },
    { label: fillNames(TEXT.stats.lastAttempt, { time: "" }).trimEnd(), value: "1:05" },
    { label: fillNames(TEXT.stats.best, { time: "" }).trimEnd(), value: "0:45" },
  ]);
  expect(vi.mocked(deathCard).mock.lastCall?.[2].totals).toEqual([
    { label: fillNames(STATS_SCOPE_TEXT.stageTotal, { time: "" }).trimEnd(), value: "2:10" },
    { label: fillNames(STATS_SCOPE_TEXT.zoneTotal, { time: "" }).trimEnd(), value: "4:50" },
    { label: fillNames(TEXT.stats.runTotal, { time: "" }).trimEnd(), value: "10:10" },
  ]);
  scene.events.emit("resume");
  scene.input.keyboard!.emit("keydown", {
    key: "Tab",
    preventDefault: vi.fn(),
    repeat: false,
    shiftKey: false,
    stopPropagation: vi.fn(),
  });
  expect(statsStatement).toHaveBeenCalledExactlyOnceWith("retry", "street");
  const point = { id: 1, wasCanceled: false, x: 190, y: 100 };
  scene.input.emit("pointerdown", point);
  scene.input.emit("pointerup", point);
  expect(opener.retryDeath).not.toHaveBeenCalled();
  expect(opener.leaveDeath).not.toHaveBeenCalled();
  const retry = { ...point, x: face.x + 1, y: face.y + 1 };
  scene.input.emit("pointerdown", retry);
  scene.input.emit("pointerup", retry);
  scene.input.emit("pointerdown", retry);
  scene.input.emit("pointerup", retry);
  expect(opener.retryDeath).toHaveBeenCalledOnce();
  expect(scene.scene.stop).toHaveBeenCalledOnce();
  expect(statsStatement).toHaveBeenCalledOnce();
});
