import { EventEmitter } from "node:events";

import { afterEach, beforeEach, expect, it, vi } from "vitest";

const selection = vi.hoisted(() => ({ active: "dash", select: vi.fn() }));
const gate = vi.hoisted(() => ({ accepts: vi.fn(() => true), close: vi.fn(), open: vi.fn() }));
vi.mock("phaser", () => ({ Scene: class {} }));
vi.mock("../input/frameTurn", () => ({ FRAME_TURN: {} }));
vi.mock("../pwa", () => ({ coverZone: vi.fn(), startWakeLock: vi.fn(), stopWakeLock: vi.fn() }));
vi.mock("../save", () => ({
  activeSkill: () => selection.active,
  savedSkills: () => ["dash", "speedy"],
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

import { SKILL_GESTURE } from "../data/skills";
import type { SkillId } from "../data/types";
import { SKILL_BUTTON, SKILL_HUD } from "../layout/skillHud";
import { PauseScene } from "./PauseScene";
import type { SkillDetailData } from "./SkillDetailScene";

beforeEach(() => {
  vi.clearAllMocks();
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
    enabledSkills: () => ["speedy"],
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
    ...SKILL_HUD.speedy,
    height: SKILL_BUTTON.target,
    width: SKILL_BUTTON.target,
  });
  gate.accepts.mockReturnValue(false);
  expect(scene.skillHudVisible()).toBe(false);
  gate.accepts.mockReturnValue(true);
  scene.state = "settings";
  expect(scene.skillHudVisible()).toBe(false);
});
