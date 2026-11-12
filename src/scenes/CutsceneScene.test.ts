// @vitest-environment happy-dom
import { EventEmitter } from "node:events";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dom = vi.hoisted(() => ({ layer: undefined as unknown }));
vi.mock("phaser", () => ({ Scene: class {} }));
vi.mock("./domUi.ts", () => ({
  artFrameUrl: (_scene: unknown, art: string) => Promise.resolve(`blob:${art}`),
  conversationControls: () => [],
  mountSceneView: (scene: { events: EventEmitter }, view: HTMLElement) => {
    const unmount = (dom.layer as UiLayer).mount(0, view);
    scene.events.once("shutdown", unmount);
    return unmount;
  },
  sceneDomUi: () => dom.layer,
}));
vi.mock("../ui/dialogue/statsStatement.ts", async (original) => {
  const { statsStatement } = await original<typeof import("../ui/dialogue/statsStatement.ts")>();
  return { statsStatement: vi.fn(statsStatement) };
});

import { ZONE_MAP } from "../data/map.ts";
import { STAGE_PREVIEWS } from "../data/stagePreviews.ts";
import { STATS_SCOPE_TEXT, TEXT } from "../data/text.ts";
import { TOUCH } from "../data/touch.ts";
import { createUiLayer, runStatLabels, statsStatement, type UiLayer } from "../ui/index.ts";
import { type CutsceneData, CutsceneScene } from "./CutsceneScene.ts";
import { pressKey } from "./pauseFixture.ts";
import { ZoneDepartureScene } from "./ZoneDepartureScene.ts";

const STAGE = ZONE_MAP.destinations[0]!.stages[0]!;
const NEXT = ZONE_MAP.destinations[0]!.stages[1]!;
const DATA: CutsceneData = {
  clearedStage: STAGE,
  percent: 1,
  runStats: { attemptSeconds: 65, attempts: 2, bestSeconds: 65, runSeconds: 120 },
  stage: NEXT,
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
};
let layer: UiLayer;

beforeEach(() => {
  vi.clearAllMocks();
  layer = createUiLayer([], document);
  document.body.append(layer.element);
  dom.layer = layer;
});

afterEach(() => {
  layer.dispose();
});

function summary(scene: CutsceneScene, data: CutsceneData = DATA) {
  const events = new EventEmitter();
  const opener = { dialogueClosed: vi.fn() };
  const route = { get: vi.fn(() => opener), start: vi.fn(), stop: vi.fn() };
  Object.assign(scene, {
    events,
    game: { events: new EventEmitter() },
    scene: route,
    textures: { exists: () => true },
  });
  scene.init(data);
  scene.create();
  const dialog = document.querySelector<HTMLElement>(".stage-summary")!;
  const button = dialog.querySelector<HTMLButtonElement>(".ui-text-button")!;
  return { button, dialog, events, opener, route };
}

function press(target: Element, x = 5, type = "pointerup") {
  const at = { bubbles: true, clientX: 5, clientY: 5, pointerId: 1 };
  target.dispatchEvent(new PointerEvent("pointerdown", at));
  if (x !== 5) {
    target.dispatchEvent(new PointerEvent("pointermove", { ...at, clientX: x }));
  }
  target.dispatchEvent(new PointerEvent(type, { ...at, clientX: x }));
}

describe("required inter-stage cutscene", () => {
  it("shows the cleared stage's summary from data, focused on the page", async () => {
    const { button, dialog } = summary(new CutsceneScene());
    await Promise.resolve();
    expect(statsStatement).toHaveBeenCalledExactlyOnceWith("clear", STAGE);
    const text = (selector: string) => dialog.querySelector(selector)?.textContent;
    const statement = statsStatement("clear", STAGE)!;
    const labels = runStatLabels(TEXT.stats);
    expect({
      button: button.textContent,
      columns: [...dialog.querySelectorAll("dl")].map((list) =>
        [...list.querySelectorAll("dt")].map(({ textContent }) => textContent),
      ),
      focused: document.activeElement === dialog,
      name: document.getElementById(dialog.getAttribute("aria-labelledby")!)?.textContent,
      preview: dialog.querySelector("img")?.getAttribute("src"),
      speaker: [text(".stage-summary-speaker"), text(".stage-summary-said")],
    }).toEqual({
      button: TEXT.map.continue,
      columns: [
        [labels.lastAttempt, labels.best, labels.attempts],
        [STATS_SCOPE_TEXT.stageTotal, STATS_SCOPE_TEXT.zoneTotal, TEXT.stats.runTotal].map(
          (template) => template.replace("{time}", "").trimEnd(),
        ),
      ],
      focused: true,
      name: text(".stage-summary-zone"),
      preview: `blob:${STAGE_PREVIEWS[STAGE]}`,
      speaker: [`${statement.name}:`, statement.text],
    });
  });

  it("rejects dismissal and held activation, then continues exactly once to the supplied stage", () => {
    const { route } = summary(new CutsceneScene());
    for (const name of ["Escape", "p", "x"]) {
      pressKey([], name);
    }
    pressKey([], "Enter", { repeat: true });
    expect(route.start).not.toHaveBeenCalled();
    pressKey([], "Tab");
    expect(document.activeElement?.textContent).toBe(TEXT.map.continue);
    pressKey([], "Enter");
    pressKey([], " ");
    expect(route.start).toHaveBeenCalledExactlyOnceWith("zone", {
      continueVisit: true,
      node: NEXT,
    });
  });

  it.each(["Continue", "statement line"])("requires a fresh undragged %s tap", (name) => {
    const { button, dialog, route } = summary(new CutsceneScene());
    const target = name === "Continue" ? button : dialog.querySelector(".stage-summary-statement")!;
    press(dialog.querySelector(".stage-summary-zone")!);
    press(target, 5 + TOUCH.tapMaxDistance + 1);
    press(target, 5, "pointercancel");
    expect(route.start).not.toHaveBeenCalled();
    press(target);
    expect(route.start).toHaveBeenCalledExactlyOnceWith("zone", {
      continueVisit: true,
      node: NEXT,
    });
  });
});

it("keeps final-zone Continue on the existing opener continuation", () => {
  const { opener, route } = summary(new ZoneDepartureScene());
  pressKey([], "Enter");
  pressKey([], "Enter");
  expect(route.stop).toHaveBeenCalledOnce();
  expect(opener.dialogueClosed).toHaveBeenCalledOnce();
  expect(route.start).not.toHaveBeenCalled();
});

it("preserves a turned-back summary without claiming a clear or inventing a statement", () => {
  const { dialog } = summary(new ZoneDepartureScene(), { ...DATA, cleared: false, percent: 0.37 });
  expect(statsStatement).not.toHaveBeenCalled();
  expect(dialog.querySelector(".stage-summary-statement")).toBeNull();
  expect(dialog.querySelector(".stage-summary-progress")?.textContent).toBe(
    TEXT.death.progress.replace("{percent}", "37"),
  );
});
