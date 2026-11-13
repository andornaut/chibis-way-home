// @vitest-environment happy-dom
import { EventEmitter } from "node:events";

import { afterEach, beforeEach, expect, it, vi } from "vitest";

const selection = vi.hoisted(() => ({
  active: "dash" as string,
  owned: ["dash", "speedy"] as string[],
  select: vi.fn(),
}));
const dom = vi.hoisted(() => ({ layer: undefined as unknown }));
vi.mock("phaser", () => ({ Core: { Events: { POST_RENDER: "postrender" } }, Scene: class {} }));
vi.mock("../ui/input/frameTurn.ts", () => ({ FRAME_TURN: { onChange: () => () => {} } }));
vi.mock("../pwa/index.ts", () => ({
  PHONE_EVENTS: { backPressed: "phone-back" },
  coverZone: vi.fn(),
  startWakeLock: vi.fn(),
  stopWakeLock: vi.fn(),
  zoneShown: vi.fn(),
}));
vi.mock("../ui/settings/touchControls.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../ui/settings/touchControls.ts")>()),
  coarsePointer: () => true,
}));
vi.mock("../dev/mode.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../dev/mode.ts")>()),
  developmentSkillOverrides: () => ({}),
}));
vi.mock("./save.ts", () => ({
  activeSkill: () => selection.active,
  savedSkills: () => selection.owned,
  selectActiveSkill: selection.select,
}));
vi.mock("./modalBackdrop.ts", () => ({
  showModalBackdrop: vi.fn(() => ({
    destroy: vi.fn(),
    ready: Promise.resolve(),
    setVisible: vi.fn(),
  })),
}));
vi.mock("./domUi.ts", () => ({
  artFrameUrl: (_scene: unknown, art: string, frame: unknown, fill?: string) =>
    Promise.resolve(`blob:${art}-${String(frame)}-${fill ?? ""}`),
  mountSceneView: (scene: { events: EventEmitter }, view: HTMLElement) => {
    const unmount = (dom.layer as UiLayer).mount(10, view);
    scene.events.once("shutdown", unmount);
    return unmount;
  },
  sceneDomUi: () => dom.layer,
}));

import { BIRD } from "../data/bird.ts";
import { SKILL_GESTURE } from "../data/skills.ts";
import { TEXT } from "../data/text.ts";
import type { SkillId } from "../data/types/index.ts";
import { SKILL_IDS } from "../progress/index.ts";
import { type BirdState, startBird } from "../rules/bird.ts";
import {
  createUiLayer,
  setTouchSettingShown,
  SKILL_ART,
  touchSettings,
  UI_DIMMED,
  type UiLayer,
} from "../ui/index.ts";
import { showModalBackdrop } from "./modalBackdrop.ts";
import { modalInput } from "./modalInput.ts";
import { createPauseScene, press, pressKey, settle, tap } from "./pauseFixture.ts";
import type { SkillDetailData } from "./SkillDetailScene.ts";

let layer: UiLayer;
const shutdowns: (() => void)[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  selection.active = "dash";
  selection.owned = ["dash", "speedy"];
  layer = createUiLayer([], document);
  document.body.append(layer.element);
  dom.layer = layer;
});

afterEach(() => {
  shutdowns.splice(0).forEach((shutdown) => shutdown());
  layer.dispose();
});

// The pause scene beside a playing zone whose bird is bird, or that has no state yet (null).
function play(bird: BirdState | null = startBird(BIRD, { x: 0, y: 0 })) {
  const game = { events: new EventEmitter() };
  const status = { zone: "running" as "paused" | "running" | "stopped" };
  const zone = {
    conversationCovers: () => false,
    playCovered: () => false,
    resumeSkillPlay: vi.fn(),
    showTouchControls: vi.fn(),
    skillState: () => (bird === null ? undefined : { bird, shown: true, tuning: BIRD }),
  };
  const scenes = {
    get: (key: string) => (key === "zone" ? zone : {}),
    isActive: (key: string) => key === "zone" && status.zone === "running",
    isPaused: (key: string) => key === "zone" && status.zone === "paused",
    key: "pause",
    launch: vi.fn(),
    pause: vi.fn((key: string) => {
      if (key === "zone") {
        status.zone = "paused";
      }
    }),
    resume: vi.fn((key: string) => {
      if (key === "zone") {
        status.zone = "running";
      }
    }),
    stop: vi.fn((key: string) => {
      if (key === "zone") {
        status.zone = "stopped";
      }
    }),
  };
  const pause = createPauseScene(game, scenes);
  shutdowns.push(() => pause.events.emit("shutdown"));
  pause.update();
  // The skill details' close, from the last launch.
  const details = () => {
    const calls = scenes.launch.mock.calls.filter(([key]) => key === "skillDetail");
    return calls.map(([, data]) => data as SkillDetailData);
  };
  const open = async () => {
    pressKey([pause.keyboard], "p");
    await settle();
    pause.update();
  };
  return { ...pause, details, game, open, scenes, status, zone };
}

it("captures the world once while touch settings update inside the single DOM modal dim", async () => {
  const original = touchSettings();
  const chrome = document.createElement("div");
  const move = document.createElement("div");
  const actions = document.createElement("div");
  const progress = document.createElement("div");
  chrome.append(move, actions, progress);
  layer.mount(1, chrome);
  const pause = play();
  pause.zone.showTouchControls.mockImplementation((settings) => {
    move.hidden = !settings.moveControls;
    actions.hidden = !settings.actionButtons;
  });
  try {
    await pause.open();
    expect(showModalBackdrop).toHaveBeenCalledTimes(1);
    expect(pause.zone.showTouchControls).not.toHaveBeenCalled();
    expect([chrome.inert, chrome.hasAttribute(UI_DIMMED)]).toEqual([true, true]);
    expect(
      [move, actions, progress, pause.hud].map((part) => part.hasAttribute(UI_DIMMED)),
    ).toEqual([false, false, false, false]);
    pause.scene.setTouchSetting("moveControls", false);
    pause.scene.setTouchSetting("actionButtons", true);
    expect([move.hidden, actions.hidden, chrome.inert, chrome.hasAttribute(UI_DIMMED)]).toEqual([
      true,
      false,
      true,
      true,
    ]);
    expect(showModalBackdrop).toHaveBeenCalledTimes(1);
    tap(pause.button(TEXT.pause.resume));
    expect([chrome.inert, chrome.hasAttribute(UI_DIMMED)]).toEqual([false, false]);
    expect(pause.status.zone).toBe("running");
  } finally {
    setTouchSettingShown("moveControls", original.moveControls);
    setTouchSettingShown("actionButtons", original.actionButtons);
  }
});

const describedBy = (button: HTMLElement) => {
  const id = button.getAttribute("aria-describedby");
  return id === null ? undefined : document.getElementById(id)?.textContent;
};

it("names the pause button and each owned skill from data, and leaves them out of Tab in play", () => {
  const { hud, pauseButton, skill } = play();
  expect({
    hidden: SKILL_IDS.map((id) => skill(id).hidden),
    live: hud.hasAttribute("data-live"),
    names: [pauseButton, ...SKILL_IDS.map(skill)].map((button) =>
      button.getAttribute("aria-label"),
    ),
    pauseShown: !pauseButton.hidden,
    pressed: SKILL_IDS.map((id) => skill(id).getAttribute("aria-pressed")),
    readiness: SKILL_IDS.map((id) => describedBy(skill(id))),
    tabIndex: [pauseButton, ...SKILL_IDS.map(skill)].map((button) => button.tabIndex),
  }).toEqual({
    hidden: SKILL_IDS.map((id) => !selection.owned.includes(id)),
    live: true,
    names: [TEXT.pause.button, ...SKILL_IDS.map((id) => TEXT.skills[id].title)],
    pauseShown: true,
    pressed: SKILL_IDS.map((id) => String(id === selection.active)),
    readiness: SKILL_IDS.map((id) => (id === selection.active ? TEXT.skillHud.ready : undefined)),
    tabIndex: [-1, -1, -1, -1],
  });
});

it("shows the selected skill's ready glyph and every other skill's muted one", async () => {
  const { skill, update } = play();
  await settle();
  update();
  const glyph = (id: SkillId) => skill(id).querySelector("img")!.getAttribute("src");
  // The sheets' first frame is the ready tag's, the second the muted tag's.
  expect(glyph("dash")).toBe(`blob:${SKILL_ART.dash}-${SKILL_ART.dash} 0.aseprite-ink`);
  expect(glyph("speedy")).toBe(`blob:${SKILL_ART.speedy}-${SKILL_ART.speedy} 1.aseprite-`);
});

// The selected skill's readiness, as its button is described.
function readiness(skill: SkillId, bird: BirdState | null) {
  selection.active = skill;
  selection.owned = [...SKILL_IDS];
  const { events, skill: button } = play(bird);
  const described = describedBy(button(skill));
  events.emit("shutdown");
  return described === TEXT.skillHud.ready;
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
  expect(readiness("doubleJump", bird)).toBe(true);
  expect(readiness("doubleJump", { ...bird, airJumpUsed: true })).toBe(false);
});

it("describes no readiness before the zone state exists", () => {
  expect(readiness("dash", null)).toBe(false);
});

it.each([
  { airUsed: false, cooldownRemainingSeconds: 0, name: "active burst", remainingSeconds: 0.1 },
  { airUsed: false, cooldownRemainingSeconds: 0.1, name: "cooldown", remainingSeconds: 0 },
  { airUsed: true, cooldownRemainingSeconds: 0, name: "spent air charge", remainingSeconds: 0 },
])(
  "mutes selected Dash during $name without changing passive Speedy",
  ({ airUsed, cooldownRemainingSeconds, remainingSeconds }) => {
    const bird = { ...startBird(BIRD, { x: 0, y: 0 }), grounded: false, jumpHeld: true };
    expect(readiness("dash", bird)).toBe(true);
    const spent = {
      ...bird,
      dash: { ...bird.dash!, airUsed, cooldownRemainingSeconds, remainingSeconds },
    };
    expect(readiness("dash", spent)).toBe(false);
    expect(readiness("speedy", spent)).toBe(true);
  },
);

it("selects a tapped skill in play, but a 400ms hold opens its details without selecting it", () => {
  const { details, skill, time, update } = play();
  const tapping = press(skill("speedy"));
  time.now = SKILL_GESTURE.holdMilliseconds - 1;
  update();
  tapping.lift();
  expect(selection.select).toHaveBeenCalledExactlyOnceWith("speedy");
  expect(details()).toEqual([]);
  selection.select.mockClear();
  const holding = press(skill("speedy"), 2);
  time.now += SKILL_GESTURE.holdMilliseconds;
  update();
  expect(details().map((data) => data.skill)).toEqual(["speedy"]);
  holding.lift();
  expect(selection.select).not.toHaveBeenCalled();
  expect(details()).toHaveLength(1);
});

it("opens details for a hold that lifts before a frame sees it", () => {
  const { details, skill, time } = play();
  const holding = press(skill("speedy"));
  time.now += SKILL_GESTURE.holdMilliseconds;
  holding.lift();
  expect(details().map((data) => data.skill)).toEqual(["speedy"]);
  expect(selection.select).not.toHaveBeenCalled();
});

it("refuses a press that leaves its skill before it lifts, even back on the skill, and its hold", () => {
  const { details, skill, time, update } = play();
  const dragging = press(skill("dash"));
  dragging.move(skill("speedy"), 60);
  dragging.move(skill("dash"), 5);
  time.now += SKILL_GESTURE.holdMilliseconds;
  update();
  dragging.lift();
  expect(selection.select).not.toHaveBeenCalled();
  expect(details()).toEqual([]);
});

it("takes a skill tap while a move finger and the Jump and Use fingers stay down", () => {
  const { skill } = play();
  const canvas = document.createElement("canvas");
  document.body.append(canvas);
  for (const pointerId of [1, 2, 3]) {
    canvas.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId }));
  }
  // With other fingers down the browser sends no click for the tap.
  press(skill("speedy"), 4).lift(skill("speedy"), 5, false);
  expect(selection.select).toHaveBeenCalledExactlyOnceWith("speedy");
  canvas.remove();
});

it("keeps presses on its controls from Phaser, which handles presses off the canvas", async () => {
  const { dialog, open, pauseButton, skill } = play();
  await open();
  const backdrop = dialog.closest(".ui-card-scene")!.querySelector(".ui-backdrop")!;
  for (const target of [pauseButton, skill("dash"), backdrop]) {
    for (const type of ["pointerdown", "touchstart", "touchend"]) {
      const event = new Event(type, { bubbles: true, cancelable: true });
      target.dispatchEvent(event);
      expect([type, event.defaultPrevented]).toEqual([type, true]);
    }
  }
});

it("keeps the HUD live beside the open card, where a tap opens details and closes no card", async () => {
  const { details, dialog, hud, open, scenes, skill } = play();
  await open();
  expect({
    cardShown: !dialog.closest<HTMLElement>(".ui-card-scene")!.hidden,
    live: hud.hasAttribute("data-live"),
    shown: !skill("dash").hidden,
    tabIndex: skill("dash").tabIndex,
  }).toEqual({ cardShown: true, live: true, shown: true, tabIndex: 0 });
  tap(skill("dash"));
  expect(details().map((data) => data.skill)).toEqual(["dash"]);
  expect(selection.select).not.toHaveBeenCalled();
  expect(scenes.resume).not.toHaveBeenCalled();
  // The card had paused the zone; details do not pause it again.
  expect(scenes.pause).toHaveBeenCalledExactlyOnceWith("zone");
});

it("steps the focus through Resume, Settings, Back to title, the skills and the close X, wrapping", async () => {
  selection.owned = [...SKILL_IDS];
  const { close, dialog, open, update } = play();
  await open();
  update();
  expect(document.activeElement).toBe(dialog);
  const name = () =>
    (document.activeElement as HTMLElement).getAttribute("aria-label") ??
    document.activeElement?.textContent;
  const names = Array.from({ length: 8 }, () => {
    pressKey([], "Tab");
    return name();
  });
  expect(names).toEqual([
    TEXT.pause.resume,
    TEXT.pause.settings,
    TEXT.pause.home,
    ...SKILL_IDS.map((id) => TEXT.skills[id].title),
    TEXT.pause.close,
    TEXT.pause.resume,
  ]);
  dialog.focus();
  pressKey([], "Tab", { shiftKey: true });
  expect(document.activeElement).toBe(close);
});

it("opens a focused skill's details on Enter under the card", async () => {
  const { details, open, scenes, skill } = play();
  await open();
  skill("speedy").focus();
  pressKey([], "Enter");
  expect(details().map((data) => data.skill)).toEqual(["speedy"]);
  expect(scenes.resume).not.toHaveBeenCalled();
});

it.each(["closed", "open"] as const)(
  "replaces %s Pause with one detail and resumes play once without reopening Pause",
  async (state) => {
    const { details, dialog, open, scenes, skill, time, update, zone } = play();
    if (state === "open") {
      await open();
      tap(skill("dash"));
    } else {
      press(skill("dash"));
      time.now += SKILL_GESTURE.holdMilliseconds;
      update();
    }
    tap(skill("dash"));
    expect(details()).toHaveLength(1);
    expect(dialog.closest<HTMLElement>(".ui-card-scene")!.hidden).toBe(true);
    expect(scenes.pause).toHaveBeenCalledExactlyOnceWith("zone");
    expect(scenes.resume).not.toHaveBeenCalled();
    details()[0]!.onClose();
    details()[0]!.onClose();
    expect(zone.resumeSkillPlay).toHaveBeenCalledOnce();
    expect(scenes.resume).toHaveBeenCalledExactlyOnceWith("zone");
    expect(details()).toHaveLength(1);
    update();
    expect(dialog.closest<HTMLElement>(".ui-card-scene")!.hidden).toBe(true);
  },
);

it("does not resume play through another modal owner when details close", () => {
  const { details, game, scenes, skill, time, update } = play();
  press(skill("dash"));
  time.now += SKILL_GESTURE.holdMilliseconds;
  update();
  const other = { events: new EventEmitter(), game };
  modalInput(other as never).open();
  details()[0]!.onClose();
  expect(scenes.resume).not.toHaveBeenCalled();
  modalInput(other as never).close();
});

it("ignores a previous detail's close callback after a newer detail has opened", () => {
  const { details, scenes, skill, time, update } = play();
  const hold = () => {
    press(skill("dash"));
    time.now += SKILL_GESTURE.holdMilliseconds;
    update();
  };
  hold();
  const first = details()[0]!;
  first.onClose();
  hold();
  scenes.resume.mockClear();
  first.onClose();
  expect(scenes.resume).not.toHaveBeenCalled();
  details()[1]!.onClose();
  expect(scenes.resume).toHaveBeenCalledExactlyOnceWith("zone");
});

it("restores every owned skill button after Back to title and the next zone", async () => {
  selection.owned = [...SKILL_IDS];
  const { button, open, scenes, skill, status, update } = play();
  await open();
  tap(button(TEXT.pause.home));
  expect(scenes.stop).toHaveBeenCalledWith("zone");
  expect(scenes.launch).toHaveBeenCalledWith("start");
  update();
  expect(SKILL_IDS.map((id) => skill(id).hidden)).toEqual([true, true, true]);
  status.zone = "running";
  selection.active = "speedy";
  update();
  expect(SKILL_IDS.map((id) => skill(id).hidden)).toEqual([false, false, false]);
  expect(SKILL_IDS.map((id) => skill(id).getAttribute("aria-pressed"))).toEqual([
    "false",
    "false",
    "true",
  ]);
});

it.each([
  ["the pause button", ({ pauseButton }: ReturnType<typeof play>) => tap(pauseButton)],
  ["P", ({ keyboard }: ReturnType<typeof play>) => pressKey([keyboard], "P")],
  ["Escape", ({ keyboard }: ReturnType<typeof play>) => pressKey([keyboard], "Escape")],
  ["back", () => window.dispatchEvent(new Event("phone-back"))],
])("opens in play by %s over the paused zone", async (_, route) => {
  const fixture = play();
  route(fixture);
  await settle();
  expect(fixture.scenes.pause).toHaveBeenCalledExactlyOnceWith("zone");
  expect(fixture.dialog.closest<HTMLElement>(".ui-card-scene")!.hidden).toBe(false);
  expect(document.activeElement).toBe(fixture.dialog);
  fixture.update();
  expect(fixture.pauseButton.hidden).toBe(true);
});

it.each([
  ["Resume", ({ button }: ReturnType<typeof play>) => tap(button(TEXT.pause.resume))],
  ["the close X", ({ close }: ReturnType<typeof play>) => tap(close)],
  ["P", () => pressKey([], "P")],
  ["Escape", () => pressKey([], "Escape")],
  ["back", () => window.dispatchEvent(new Event("phone-back"))],
  [
    "a tap outside the card",
    ({ dialog }: ReturnType<typeof play>) =>
      tap(dialog.closest(".ui-card-scene")!.querySelector(".ui-backdrop")!),
  ],
])("closes by %s and resumes the zone", async (_, route) => {
  const fixture = play();
  await fixture.open();
  route(fixture);
  expect(fixture.scenes.resume).toHaveBeenCalledExactlyOnceWith("zone");
  expect(fixture.dialog.closest<HTMLElement>(".ui-card-scene")!.hidden).toBe(true);
  fixture.update();
  expect(fixture.pauseButton.hidden).toBe(false);
});
