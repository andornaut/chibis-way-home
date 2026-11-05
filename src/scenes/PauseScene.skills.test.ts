import { EventEmitter } from "node:events";

import { afterEach, beforeEach, expect, it, vi } from "vitest";

const selection = vi.hoisted(() => ({
  active: "dash",
  owned: ["dash", "speedy"],
  select: vi.fn(),
}));
const gate = vi.hoisted(() => ({ accepts: vi.fn(() => true), close: vi.fn(), open: vi.fn() }));
vi.mock("phaser", () => ({ Scene: class {} }));
vi.mock("../ui/input/frameTurn", () => ({ FRAME_TURN: {} }));
vi.mock("../pwa", () => ({ coverZone: vi.fn(), startWakeLock: vi.fn(), stopWakeLock: vi.fn() }));
vi.mock("./save", () => ({
  activeSkill: () => selection.active,
  savedSkills: () => selection.owned,
  selectActiveSkill: selection.select,
}));
vi.mock("./modalInput", () => ({
  modalInput: () => gate,
  onScenePointer: (
    scene: { input: EventEmitter },
    event: string,
    listener: (pointer: unknown) => void,
  ) => scene.input.on(event, listener),
}));

import { BIRD } from "../data/bird";
import { SCREEN } from "../data/screen";
import { SKILL_GESTURE } from "../data/skills";
import type { SkillId } from "../data/types";
import { SKILL_IDS } from "../progress";
import { type BirdState, startBird } from "../rules/bird";
import { SKILL_BUTTON, skillHud } from "../ui";
import { PauseScene } from "./PauseScene";
import type { SkillDetailData } from "./SkillDetailScene";

beforeEach(() => {
  vi.clearAllMocks();
  selection.active = "dash";
  selection.owned = ["dash", "speedy"];
  gate.accepts.mockReturnValue(true);
});
afterEach(() => vi.restoreAllMocks());

function fixture(state: "closed" | "open") {
  const zone = { playCovered: vi.fn(() => false), resumeSkillPlay: vi.fn() };
  const dim = { destroy: vi.fn() };
  const scene = Object.assign(new PauseScene(), {
    dims: new Map([["dim", dim]]),
    enabledSkills: () => ["dash"],
    input: {},
    scene: {
      get: () => zone,
      isActive: () => true,
      launch: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
    },
    showCard: vi.fn(),
    state,
  }) as unknown as {
    openSkill(skill: SkillId): void;
    state: string;
    scene: {
      launch: ReturnType<typeof vi.fn>;
      pause: ReturnType<typeof vi.fn>;
      resume: ReturnType<typeof vi.fn>;
    };
  };
  return { dim, scene, zone };
}

it.each(["closed", "open"] as const)(
  "replaces %s Pause with one detail and resumes play once without reopening Pause",
  (state) => {
    const { dim, scene, zone } = fixture(state);
    scene.openSkill("dash");
    scene.openSkill("dash");
    expect(scene.state).toBe("skill");
    expect(dim.destroy).toHaveBeenCalledOnce();
    expect(gate.open).toHaveBeenCalledOnce();
    expect(gate.close).not.toHaveBeenCalled();
    expect(scene.scene.launch).toHaveBeenCalledOnce();
    expect(scene.scene.pause).toHaveBeenCalledExactlyOnceWith("zone");
    expect(scene.scene.resume).not.toHaveBeenCalled();
    const [key, data] = scene.scene.launch.mock.calls[0] as [string, SkillDetailData];
    expect(key).toBe("skillDetail");
    data.onClose();
    data.onClose();
    expect(scene.state).toBe("closed");
    expect(zone.resumeSkillPlay).toHaveBeenCalledOnce();
    expect(scene.scene.resume).toHaveBeenCalledExactlyOnceWith("zone");
    expect(scene.scene.launch).toHaveBeenCalledOnce();
  },
);

it("does not open locked skills or resume through another modal owner", () => {
  const { scene, zone } = fixture("closed");
  scene.openSkill("speedy");
  expect(scene.scene.launch).not.toHaveBeenCalled();
  scene.openSkill("dash");
  const data = scene.scene.launch.mock.calls[0]![1] as SkillDetailData;
  gate.accepts.mockReturnValue(false);
  data.onClose();
  expect(zone.resumeSkillPlay).toHaveBeenCalledOnce();
  expect(scene.scene.resume).not.toHaveBeenCalled();
});

it("ignores a previous detail's close callback after a newer detail has opened", () => {
  const { scene } = fixture("closed");
  scene.openSkill("dash");
  const old = scene.scene.launch.mock.calls[0]![1] as SkillDetailData;
  old.onClose();
  scene.openSkill("dash");
  old.onClose();
  expect(scene.state).toBe("skill");
  expect(scene.scene.resume).toHaveBeenCalledOnce();
  const current = scene.scene.launch.mock.calls[1]![1] as SkillDetailData;
  current.onClose();
  expect(scene.scene.resume).toHaveBeenCalledTimes(2);
});

it("consumes HUD gestures and rejects a drag that returns to the same icon", () => {
  const input = Object.assign(new EventEmitter(), { stopPropagation: vi.fn() });
  const press = vi.fn();
  const scene = Object.assign(new PauseScene(), {
    controlAt: () => "dash",
    input,
    press,
    setPressed(this: { pressed: string | undefined }, value: string | undefined) {
      this.pressed = value;
    },
    time: { now: 0 },
  }) as unknown as { watchPresses(): void };
  scene.watchPresses();
  input.emit("pointerdown", { id: 1, x: 20, y: 20 });
  input.emit("pointermove", { id: 1, x: 120, y: 20 });
  input.emit("pointerup", { id: 1, x: 20, y: 20 });
  expect(press).not.toHaveBeenCalled();
  input.emit("pointerdown", { id: 1, x: 20, y: 20 });
  input.emit("pointerup", { id: 1, x: 20, y: 20 });
  expect(press).toHaveBeenCalledExactlyOnceWith("dash");
  expect(input.stopPropagation).toHaveBeenCalledTimes(5);
});

function gestures(state: "closed" | "open") {
  const input = Object.assign(new EventEmitter(), { stopPropagation: vi.fn() });
  const openSkill = vi.fn();
  const time = { now: 0 };
  const scene = Object.assign(new PauseScene(), {
    controlAt: () => "speedy",
    input,
    openSkill,
    setPressed(this: { pressed: string | undefined }, value: string | undefined) {
      this.pressed = value;
    },
    skillHudVisible: () => true,
    state,
    sys: { isActive: () => true },
    time,
  }) as unknown as { watchPresses(): void; updateSkillHold(): void };
  scene.watchPresses();
  return { input, openSkill, scene, time };
}

it("selects a playing tap, but a hold opens details without selecting the held skill", () => {
  const { input, openSkill, scene, time } = gestures("closed");
  input.emit("pointerdown", { id: 1, x: 20, y: 20 });
  time.now = SKILL_GESTURE.holdMilliseconds - 1;
  input.emit("pointerup", { id: 1, x: 20, y: 20 });
  expect(selection.select).toHaveBeenCalledExactlyOnceWith("speedy");
  expect(openSkill).not.toHaveBeenCalled();
  selection.select.mockClear();
  input.emit("pointerdown", { id: 2, x: 20, y: 20 });
  time.now += SKILL_GESTURE.holdMilliseconds;
  scene.updateSkillHold();
  input.emit("pointerup", { id: 2, x: 20, y: 20 });
  expect(openSkill).toHaveBeenCalledExactlyOnceWith("speedy");
  expect(selection.select).not.toHaveBeenCalled();
});

it("opens paused HUD details without selecting and covers their targets against outside dismissal", () => {
  const { input, openSkill } = gestures("open");
  input.emit("pointerdown", { id: 1, x: 20, y: 20 });
  input.emit("pointerup", { id: 1, x: 20, y: 20 });
  expect(openSkill).toHaveBeenCalledExactlyOnceWith("speedy");
  expect(selection.select).not.toHaveBeenCalled();
  const hit = { height: 48, width: 48, x: 0, y: 100 };
  const zone = { playCovered: () => false };
  const scene = Object.assign(new PauseScene(), {
    enabledSkills: () => ["dash"],
    layout: { card: hit, close: { hit }, home: { hit }, resume: { hit }, settings: { hit } },
    scene: { get: () => zone, isPaused: () => true },
    state: "open",
  }) as unknown as {
    coveredCard(): readonly { x: number; y: number; width: number; height: number }[];
    skillHudVisible(): boolean;
    state: string;
  };
  expect(scene.skillHudVisible()).toBe(true);
  expect(scene.coveredCard()).toContainEqual({
    height: SKILL_BUTTON.target,
    width: SKILL_BUTTON.target,
    ...skillHud(SKILL_IDS).get("speedy"),
  });
  gate.accepts.mockReturnValue(false);
  expect(scene.skillHudVisible()).toBe(false);
  gate.accepts.mockReturnValue(true);
  scene.state = "settings";
  expect(scene.skillHudVisible()).toBe(false);
});

function readiness(bird: BirdState | undefined) {
  return Object.assign(new PauseScene(), {
    scene: {
      get: () => ({ skillState: () => (bird === undefined ? undefined : { bird, tuning: BIRD }) }),
    },
  }) as unknown as {
    skillReady(skill: SkillId): boolean;
  };
}
it.each([
  { grounded: true, jumpHeld: false, name: "grounded" },
  { grounded: false, jumpHeld: true, name: "holding Jump" },
  { grounded: false, jumpHeld: false, name: "inside coyote time" },
])("keeps recharged Double jump ready while $name", ({ grounded, jumpHeld }) => {
  const bird = {
    ...startBird(BIRD, { x: 0, y: 0 }),
    coyoteLeft: BIRD.coyoteTime,
    grounded,
    jumpHeld,
  };
  expect(readiness(bird).skillReady("doubleJump")).toBe(true);
  expect(readiness({ ...bird, airJumpUsed: true }).skillReady("doubleJump")).toBe(false);
});
it("has no HUD readiness before the zone state exists", () => {
  expect(readiness(undefined).skillReady("dash")).toBe(false);
});
it.each([
  { airUsed: false, cooldownRemainingSeconds: 0, name: "active burst", remainingSeconds: 0.1 },
  { airUsed: false, cooldownRemainingSeconds: 0.1, name: "cooldown", remainingSeconds: 0 },
  { airUsed: true, cooldownRemainingSeconds: 0, name: "spent air charge", remainingSeconds: 0 },
])(
  "mutes equipped Dash during $name without changing passive Speedy",
  ({ airUsed, cooldownRemainingSeconds, remainingSeconds }) => {
    const bird = { ...startBird(BIRD, { x: 0, y: 0 }), grounded: false, jumpHeld: true };
    expect(readiness(bird).skillReady("dash")).toBe(true);
    const spent = {
      ...bird,
      dash: { ...bird.dash!, airUsed, cooldownRemainingSeconds, remainingSeconds },
    };
    expect(readiness(spent).skillReady("dash")).toBe(false);
    expect(readiness(spent).skillReady("speedy")).toBe(true);
  },
);
it("restores every owned HUD icon after returning home and continuing with one selected skill", () => {
  selection.owned = [...SKILL_IDS];
  let playing = true;
  const bird = startBird(BIRD, { x: 0, y: 0 });
  const zone = {
    playCovered: () => false,
    skillState: () => ({ bird, shown: true, tuning: BIRD }),
  };
  const icons = new Map(
    selection.owned.map((skill) => [
      skill,
      { place: vi.fn(), ready: vi.fn(), selected: vi.fn(), visible: vi.fn() },
    ]),
  );
  const scene = Object.assign(new PauseScene(), {
    dims: new Map(),
    hud: icons,
    input: {},
    scale: { gameSize: SCREEN },
    scene: {
      get: () => zone,
      isActive: () => playing,
      launch: vi.fn(),
      stop: () => {
        playing = false;
      },
    },
    showCard: vi.fn(),
    state: "closed",
  }) as unknown as {
    returnHome(): void;
    showSkillHud(): void;
  };
  const check = () => {
    scene.showSkillHud();
    for (const [skill, icon] of icons) {
      expect(icon.visible).toHaveBeenLastCalledWith(playing);
      expect(icon.selected).toHaveBeenLastCalledWith(skill === selection.active);
      expect(icon.ready).toHaveBeenLastCalledWith(skill === selection.active);
    }
  };
  check();
  scene.returnHome();
  check();
  playing = true;
  check();
  selection.active = "speedy";
  check();
  expect(selection.owned).toEqual(SKILL_IDS);
});
