import { EventEmitter } from "node:events";

import { frameSteps, startStepClock } from "@andornaut/game-kit/clock/fixedStep";
import { afterEach, expect, it, vi } from "vitest";

import { BIRD } from "../data/bird";
import { SCREEN } from "../data/screen";
import { SKILLS } from "../data/skills";
import { TOUCH } from "../data/touch";
import type { SkillId } from "../data/types";
import { type HeldTouch, touchIntent } from "../input/intent";
import { PAUSE_BUTTON } from "../layout/pauseCard";
import { bottomShift, shifted, topShift } from "../layout/playView";
import { SKILL_HUD } from "../layout/skillHud";
import { TOUCH_CONTROLS } from "../layout/touchControls";
import { startBird } from "../rules/bird";
import { SKILL_IDS } from "../rules/skills";
import { STEP_MS } from "../rules/step";
import * as engine from "../rules/zone";

const saved = vi.hoisted(() => ({ active: null as SkillId | null, owned: [] as SkillId[] }));
const routing = vi.hoisted(() => ({ accepts: true }));
vi.mock("phaser", () => ({ Input: {}, Scale: {}, Scene: class {}, Scenes: {} }));
vi.mock("../input/frameTurn", () => ({ FRAME_TURN: { turn: () => 0 } }));
vi.mock("./modalInput", () => ({ modalInput: () => ({ accepts: () => routing.accepts }) }));
vi.mock("../settings/touchControls", () => ({ touchSettingShown: () => true }));
vi.mock("../dev/mode", () => ({
  developmentSkillOverrides: () => ({}),
  invulnerabilityEnabled: () => false,
  isDevelopmentSession: () => false,
}));
vi.mock("../save", () => ({
  activeSkill: () => saved.active,
  recordActiveStageStep: vi.fn(),
  savedSkills: () => saved.owned,
}));

import { ZoneScene } from "./ZoneScene";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it.each<SkillId | null>([null, "dash", "doubleJump", "speedy"])(
  "passes only selected %s to actual world physics",
  (selected) => {
    vi.stubGlobal("window", { location: { search: "" } });
    saved.active = selected;
    const world = {
      area: "main",
      bird: startBird(BIRD, { x: 0, y: 0 }),
      steps: 0,
    } as engine.ZoneState;
    const step = vi
      .spyOn(engine, "stepZone")
      .mockImplementation((_tuning, _layout, _seconds, _input, state) => ({
        ...state,
        death: {
          position: { x: 0, y: 0 },
          reason: "fall",
          support: undefined,
          velocity: { x: 0, y: 0 },
        },
        steps: state.steps + 1,
      }));
    const scene = Object.assign(new ZoneScene(), {
      beginDeath(this: { dying: unknown }) {
        this.dying = {};
      },
      clock: frameSteps({ maxFrameMs: 100, stepMs: STEP_MS }, 0, startStepClock).clock,
      drawDeath: vi.fn(),
      layout: {},
      loading: false,
      openProximityDialogue: () => false,
      stageKey: () => "stage",
      zone: world,
    }) as unknown as { update(time: number): void };
    scene.update(STEP_MS * 2);
    expect(step).toHaveBeenCalledOnce();
    const profile = step.mock.calls[0]![0];
    expect(profile.doubleJump).toBe(selected === "doubleJump");
    expect(profile.dash).toEqual(selected === "dash" ? BIRD.dash : undefined);
    expect(profile.walkSpeed).toBe(
      BIRD.walkSpeed * (selected === "speedy" ? SKILLS.speedyWalkMultiplier : 1),
    );
    expect(profile.jumpSpeed).toBe(BIRD.jumpSpeed);
  },
);

function touchFixture() {
  routing.accepts = true;
  saved.owned = [...SKILL_IDS];
  const host = Object.assign(new EventTarget(), {
    location: { search: "" },
    matchMedia: () => ({ matches: true }),
  });
  vi.stubGlobal("window", host);
  const size = { height: SCREEN.height + 120, width: SCREEN.width + 120 };
  const bounds = { height: size.height / 2, width: size.width / 2, x: 100, y: 50 };
  const canvas = { getBoundingClientRect: () => bounds };
  const sprite = () => ({
    anims: {},
    frame: { height: 1, width: 1 },
    play: vi.fn(),
    setPosition(x: number, y: number) {
      this.x = x;
      this.y = y;
      return this;
    },
    setVisible(value: boolean) {
      this.visible = value;
      return this;
    },
    texture: { key: "ui-move-hint" },
    visible: true,
    x: 0,
    y: 0,
  });
  const ring = sprite();
  const knob = sprite();
  const state = { active: true, covered: false, hudShown: true };
  const events = new EventEmitter();
  const scene = Object.assign(new ZoneScene(), {
    controls: new Map(),
    events,
    game: { canvas },
    moveHint: { knob, ring },
    playCovered: () => state.covered,
    scale: { gameSize: size },
    scene: { isActive: () => state.active },
    skillState: () => ({ shown: state.hudShown }),
  }) as unknown as {
    buttonTouches: Set<number>;
    heldTouches: Map<number, HeldTouch>;
    watchTouches(): void;
    drawMoveHint(touches: readonly HeldTouch[]): void;
    showTouchControls(settings: { actionButtons: boolean; moveControls: boolean }): void;
  };
  scene.watchTouches();
  const send = (
    type: string,
    pointerId: number,
    point: {
      x: number;
      y: number;
    },
    target: unknown = canvas,
  ) => {
    const event = new Event(type);
    Object.defineProperties(event, {
      clientX: { value: bounds.x + point.x / 2 },
      clientY: { value: bounds.y + point.y / 2 },
      pointerId: { value: pointerId },
      pointerType: { value: "touch" },
      target: { value: target },
    });
    host.dispatchEvent(event);
  };
  const draw = () => {
    scene.drawMoveHint([...scene.heldTouches.values()]);
    return ring.visible;
  };
  return { canvas, draw, events, knob, ring, scene, send, size, state };
}
it.each([
  ...SKILL_IDS.map((skill) => ({ control: skill, role: undefined })),
  { control: "pause", role: undefined },
  { control: "use", role: "use" },
  { control: "jump", role: "jump" },
  { control: "page button", role: undefined },
])("keeps $control touches out of movement through drag and release", ({ control, role }) => {
  const f = touchFixture();
  const point =
    control === "use" || control === "jump"
      ? shifted(bottomShift(f.size), TOUCH_CONTROLS[control].centre)
      : control === "pause"
        ? shifted(topShift(f.size), PAUSE_BUTTON.at)
        : shifted(topShift(f.size), SKILL_HUD[control as SkillId] ?? { x: 100, y: 100 });
  const target = control === "page button" ? { closest: () => ({}) } : f.canvas;
  expect(f.draw()).toBe(true);
  f.send("pointerdown", 1, point, target);
  expect(f.scene.heldTouches.get(1)?.role).toBe(role);
  expect(f.draw()).toBe(false);
  f.send("pointermove", 1, { x: 250, y: 180 }, target);
  expect(f.scene.heldTouches.get(1)?.role).toBe(role);
  expect(f.draw()).toBe(false);
  f.scene.showTouchControls({ actionButtons: true, moveControls: true });
  expect(f.ring.visible).toBe(false);
  f.send("pointerup", 1, { x: 250, y: 180 }, target);
  expect(f.scene.heldTouches.size).toBe(0);
  expect(f.scene.buttonTouches.size).toBe(0);
  expect(f.draw()).toBe(true);
  f.events.emit("shutdown");
});
it("retains the movement finger's joystick while another finger holds or releases buttons", () => {
  const f = touchFixture();
  const start = { x: 200, y: 180 };
  const hud = shifted(topShift(f.size), SKILL_HUD.doubleJump);
  const use = shifted(bottomShift(f.size), TOUCH_CONTROLS.use.centre);
  f.send("pointerdown", 1, start);
  f.send("pointermove", 1, { ...start, x: start.x + TOUCH.moveDeadZone + 1 });
  f.send("pointerdown", 2, use);
  f.send("pointerdown", 3, hud);
  expect(touchIntent(TOUCH, [...f.scene.heldTouches.values()])).toMatchObject({
    move: 1,
    use: true,
  });
  expect(f.draw()).toBe(true);
  expect({ x: f.ring.x, y: f.ring.y }).toEqual(start);
  f.send("pointerup", 2, use);
  expect(f.scene.heldTouches.has(1)).toBe(true);
  expect(f.draw()).toBe(true);
  f.send("pointerup", 1, start);
  expect(f.draw()).toBe(false);
  f.send("pointercancel", 3, hud);
  expect(f.draw()).toBe(true);
  f.events.emit("shutdown");
});
it("does not reserve hidden or unowned skill targets", () => {
  const f = touchFixture();
  const point = shifted(topShift(f.size), SKILL_HUD.doubleJump);
  f.state.hudShown = false;
  f.send("pointerdown", 1, point);
  expect(f.scene.heldTouches.get(1)?.role).toBe("move");
  f.send("pointerup", 1, point);
  f.state.hudShown = true;
  saved.owned = [];
  f.send("pointerdown", 2, point);
  expect(f.scene.heldTouches.get(2)?.role).toBe("move");
  f.events.emit("shutdown");
});
it("keeps blocked modal and room presses out of movement and clears their lifetime on cancel or shutdown", () => {
  const f = touchFixture();
  const point = { x: 200, y: 180 };
  routing.accepts = false;
  f.send("pointerdown", 1, point);
  expect(f.scene.heldTouches.size).toBe(0);
  routing.accepts = true;
  expect(f.draw()).toBe(false);
  f.send("pointercancel", 1, point);
  expect(f.draw()).toBe(true);
  f.state.active = false;
  f.send("pointerdown", 2, point);
  expect(f.scene.heldTouches.size).toBe(0);
  f.events.emit("shutdown");
  expect(f.scene.buttonTouches.size).toBe(0);
  expect(f.scene.heldTouches.size).toBe(0);
});
