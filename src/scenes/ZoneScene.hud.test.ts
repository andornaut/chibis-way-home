// @vitest-environment happy-dom
import { EventEmitter } from "node:events";

import { type AsepriteSheet, sheetTags } from "@andornaut/game-kit/art/aseprite";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import jumpSheet from "../../public/art/sprites/ui-touch-jump.json" with { type: "json" };
import useSheet from "../../public/art/sprites/ui-touch-use.json" with { type: "json" };
import { TOUCH } from "../data/touch.ts";
import type { Point } from "../data/types/index.ts";
import {
  type HeldTouch,
  setTouchSettingShown,
  shifted,
  stageProgressRect,
  type StageProgressView,
  type TouchControlsState,
  type TouchControlsView,
  touchIntent,
  touchLayout,
} from "../ui/index.ts";

vi.mock("phaser", () => ({
  Core: { Events: { PRE_RENDER: "prerender" } },
  Input: {},
  Scale: {},
  Scene: class {
    readonly events = new EventEmitter();
    readonly game = { canvas: document.createElement("canvas"), events: new EventEmitter() };
    readonly scale = { gameSize: { height: 1000, width: 2600 }, zoom: 0.5 };
    readonly scene = { isActive: () => true, isVisible: vi.fn(() => true) };
  },
  Scenes: {},
}));
vi.mock("../ui/input/frameTurn.ts", () => ({ FRAME_TURN: { turn: () => 0 } }));
vi.mock("./cardParts.ts", () => ({
  paletteColour: (_scene: unknown, name: "cream" | "ink" | "white") =>
    ({ cream: 1, ink: 0, white: 2 })[name],
}));
vi.mock("./domUi.ts", () => ({
  mountSceneView: (scene: { events: EventEmitter }, root: HTMLElement) => {
    document.body.append(root);
    scene.events.once("shutdown", () => root.remove());
  },
  sceneDomUi: () => ({ element: document.body }),
}));
vi.mock("./modalInput.ts", () => ({ modalInput: () => ({ accepts: () => true }) }));

import { canvasRect, sceneFit, sceneViewShift } from "./playCamera.ts";
import { ZoneScene } from "./ZoneScene.ts";

interface HudHarness extends Omit<ZoneScene, "showTouchControls"> {
  actionButtonsShown: boolean;
  backdrop: boolean;
  heldTouches: Map<number, HeldTouch>;
  hud: { readonly progress: StageProgressView; readonly touch: TouchControlsView } | undefined;
  loading: boolean;
  preview: object | undefined;
  touchVisuals: TouchControlsState["controls"];
  zone: { death?: object };
  createHud(): void;
  drawControls(nowMs: number, touches: readonly HeldTouch[]): void;
  drawMoveHint(touches: readonly HeldTouch[]): void;
  drawProgress(): void;
  placeControls(): void;
  showTouchControls(settings: { actionButtons: boolean; moveControls: boolean }): void;
  watchTouches(): void;
}

const scenes: HudHarness[] = [];
function fixture(): HudHarness {
  const scene = Object.assign(new ZoneScene(), {
    cache: { json: { get: (key: string) => (key === "ui-touch-jump" ? jumpSheet : useSheet) } },
    dialogueOpen: () => false,
    loading: false,
    progressFraction: () => 0.25,
    zone: {},
  }) as unknown as HudHarness;
  scenes.push(scene);
  return scene;
}

beforeEach(() => {
  document.body.replaceChildren();
  vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true } as MediaQueryList);
  setTouchSettingShown("actionButtons", true);
  setTouchSettingShown("moveControls", true);
});
afterEach(() => {
  scenes.splice(0).forEach((scene) => scene.events.emit("shutdown"));
  vi.restoreAllMocks();
});

it("passes shifted action centres, floating canvas centres and canvas-bottom progress exactly once", () => {
  const scene = fixture();
  scene.createHud();
  scene.placeControls();
  const fit = sceneFit(scene);
  const shift = sceneViewShift(scene);
  expect(shift.x).toBeGreaterThan(0);
  expect(scene.touchVisuals.jump.centre).toEqual(
    shifted(shift, touchLayout(fit).buttons.jump.centre),
  );
  const mover: HeldTouch = { role: "move", startX: 1, startY: 250, x: 100 };
  scene.drawMoveHint([mover]);
  expect(scene.touchVisuals.move.centre).toEqual({ x: 1, y: 250 });
  expect(scene.touchVisuals.move.pose).toBe("held-right");
  expect(scene.hud!.touch.root.style.getPropertyValue("--touch-canvas-width")).toBe(
    String(canvasRect(scene).width),
  );
  const rect = stageProgressRect(fit);
  expect(scene.hud!.progress.element!.style.left).toBe(`${rect.x}px`);
  expect(scene.hud!.progress.element!.style.top).toBe(`${rect.y}px`);
  expect(scene.hud!.progress.element!.getAttribute("aria-valuenow")).toBe("0.25");
});

it("keeps the existing press clock through the expanded frame, press tail, hold and release", () => {
  const scene = fixture();
  scene.createHud();
  const held: HeldTouch[] = [{ role: "jump", startX: 0, startY: 0, x: 0 }];
  const press = sheetTags(jumpSheet as AsepriteSheet).get("press")!;
  const first = press[0]!.duration;
  const total = press.reduce((sum, frame) => sum + frame.duration, 0);
  scene.drawControls(10, held);
  expect(scene.touchVisuals.jump).toMatchObject({ expanded: true, pose: "press", shown: true });
  scene.drawControls(10 + first, held);
  expect(scene.touchVisuals.jump).toMatchObject({ expanded: false, pose: "press" });
  scene.drawControls(10 + total, held);
  expect(scene.touchVisuals.jump.pose).toBe("held");
  scene.drawControls(10 + total + 1, []);
  expect(scene.touchVisuals.jump).toMatchObject({ expanded: false, pose: "rest" });
});

it("updates paused settings immediately while hidden touch drawings retain the same input roles", () => {
  const scene = fixture();
  scene.createHud();
  scene.watchTouches();
  setTouchSettingShown("actionButtons", false);
  setTouchSettingShown("moveControls", false);
  scene.showTouchControls({ actionButtons: false, moveControls: false });
  expect(scene.actionButtonsShown).toBe(false);
  expect(Object.values(scene.touchVisuals).every(({ shown }) => !shown)).toBe(true);
  const css = { height: 500, width: 1300 };
  vi.spyOn(scene.game.canvas, "getBoundingClientRect").mockReturnValue(
    new DOMRect(0, 0, css.width, css.height),
  );
  const canvas = canvasRect(scene);
  const at: Point = scene.touchVisuals.jump.centre;
  const send = (type: string) => {
    scene.game.canvas.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        clientX: (at.x * css.width) / canvas.width,
        clientY: (at.y * css.height) / canvas.height,
        pointerId: 1,
        pointerType: "touch",
      }),
    );
  };
  document.body.append(scene.game.canvas);
  send("pointerdown");
  expect(touchIntent(TOUCH, [...scene.heldTouches.values()]).jump).toBe(true);
  send("pointerup");
  expect(scene.heldTouches.size).toBe(0);
});

it("tracks Room hiding, loading and death without a world update, then removes its global listener", () => {
  const scene = fixture();
  scene.createHud();
  scene.placeControls();
  const { progress, touch } = scene.hud!;
  vi.mocked(scene.scene.isVisible).mockReturnValue(false);
  scene.game.events.emit("prerender");
  expect(touch.root.hidden).toBe(true);
  expect(progress.root.hidden).toBe(true);
  vi.mocked(scene.scene.isVisible).mockReturnValue(true);
  scene.loading = true;
  scene.game.events.emit("prerender");
  expect(progress.root.hidden).toBe(true);
  scene.loading = false;
  scene.zone.death = {};
  scene.showTouchControls({ actionButtons: true, moveControls: true });
  scene.game.events.emit("prerender");
  expect(progress.root.hidden).toBe(false);
  expect(touch.root.hidden).toBe(false);
  expect(Object.values(scene.touchVisuals).every(({ shown }) => !shown)).toBe(true);
  scene.events.emit("shutdown");
  expect(scene.game.events.listenerCount("prerender")).toBe(0);
  expect(touch.root.isConnected).toBe(false);
  expect(progress.root.isConnected).toBe(false);
});

it("does not mount a HUD for a stage preview or the title backdrop", () => {
  const preview = fixture();
  preview.preview = {};
  preview.createHud();
  const backdrop = fixture();
  backdrop.backdrop = true;
  backdrop.createHud();
  expect(document.querySelector(".touch-controls-scene, .stage-progress-scene")).toBeNull();
});
