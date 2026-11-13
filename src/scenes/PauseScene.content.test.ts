// @vitest-environment happy-dom
import { EventEmitter } from "node:events";

import { afterEach, beforeEach, expect, it, vi } from "vitest";

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
vi.mock("./save.ts", () => ({ activeSkill: () => undefined, savedSkills: () => [] }));
vi.mock("./modalBackdrop.ts", () => ({
  showModalBackdrop: () => ({ destroy: vi.fn(), ready: Promise.resolve(), setVisible: vi.fn() }),
}));
vi.mock("./domUi.ts", () => ({
  artFrameUrl: () => Promise.resolve("blob:glyph"),
  sceneDomUi: () => dom.layer,
}));

import { TEXT } from "../data/text.ts";
import { coverZone } from "../pwa/index.ts";
import { coarsePointer, createUiLayer, type UiLayer } from "../ui/index.ts";
import { modalInput } from "./modalInput.ts";
import { createPauseScene, pressKey, settle, tap } from "./pauseFixture.ts";

let layer: UiLayer;
const shutdowns: (() => void)[] = [];
beforeEach(() => {
  layer = createUiLayer([], document);
  dom.layer = layer;
  document.body.append(layer.element);
});
afterEach(() => {
  shutdowns.splice(0).forEach((stop) => stop());
  layer.dispose();
});

function content() {
  const game = { events: new EventEmitter() };
  const active = new Set<string>(["map"]);
  const paused = new Set<string>();
  const zone = { playCovered: () => false, skillState: () => undefined };
  const owners = new Map<string, object>();
  const get = (key: string) => {
    if (key === "zone") {
      return zone;
    }
    if (!owners.has(key)) {
      owners.set(key, { events: new EventEmitter(), game });
    }
    return owners.get(key)!;
  };
  const scenes = {
    bringToTop: vi.fn(),
    get,
    isActive: (key: string) => active.has(key),
    isPaused: (key: string) => paused.has(key),
    key: "pause",
    launch: vi.fn(),
    pause: vi.fn((key: string) => {
      active.delete(key);
      paused.add(key);
    }),
    resume: vi.fn((key: string) => {
      paused.delete(key);
      active.add(key);
    }),
    stop: vi.fn((key: string) => {
      active.delete(key);
      paused.delete(key);
    }),
  };
  const pause = createPauseScene(game, scenes);
  shutdowns.push(() => pause.events.emit("shutdown"));
  return { active, get, pause, paused, scenes };
}

it("keeps the top-left overlay visible on fine-pointer content, except title and initial loading", () => {
  expect(coarsePointer(window)).toBe(false);
  const { active, pause } = content();
  for (const key of [
    "map",
    "opening",
    "room",
    "cutscene",
    "celebration",
    "zoneIntroduction",
    "death",
  ]) {
    active.clear();
    active.add(key);
    pause.update();
    expect(pause.pauseButton.hidden, key).toBe(false);
    expect(pause.pauseButton.disabled, key).toBe(key === "death");
  }
  expect(pause.root.dataset.uiOrder).toBe(String(Number.MAX_SAFE_INTEGER));
  for (const key of ["start", "boot"]) {
    active.clear();
    active.add(key);
    pause.update();
    expect(pause.pauseButton.hidden, key).toBe(true);
  }
});

it("leaves ordinary cards guarded, then pauses and resumes only the active content", async () => {
  const { active, get, pause, paused, scenes } = content();
  paused.add("zone");
  for (const key of [
    "stageSelect",
    "restart",
    "achievements",
    "death",
    "skillDetail",
    "settings",
  ]) {
    const card = get(key);
    active.add(key);
    modalInput(card as never).open();
    pause.update();
    expect(pause.pauseButton.hidden, key).toBe(false);
    expect(pause.pauseButton.disabled, key).toBe(true);
    tap(pause.pauseButton);
    pressKey([pause.keyboard], "P");
    expect(scenes.pause).not.toHaveBeenCalled();
    modalInput(card as never).close();
    active.delete(key);
  }
  pause.update();
  tap(pause.pauseButton);
  await settle();
  expect(scenes.pause).toHaveBeenCalledExactlyOnceWith("map");
  expect(scenes.bringToTop).toHaveBeenCalledOnce();
  expect(pause.pauseButton.hidden).toBe(false);
  expect(pause.pauseButton.disabled).toBe(true);
  tap(pause.button(TEXT.pause.settings));
  expect(scenes.launch).toHaveBeenCalledExactlyOnceWith("settings", { opener: "pause" });
  expect(scenes.resume).not.toHaveBeenCalled();
  pause.scene.settingsClosed();
  tap(pause.button(TEXT.pause.resume));
  expect(scenes.resume).toHaveBeenCalledExactlyOnceWith("map");
  expect(paused.has("zone")).toBe(true);
});

it("captures Pause before story keys and freezes simultaneous content without consuming a story action", async () => {
  const { active, get, pause, scenes } = content();
  active.clear();
  active.add("opening");
  active.add("zoneIntroduction");
  const opening = get("opening");
  modalInput(opening as never).open();
  const story = document.createElement("button");
  document.body.append(story);
  const advance = vi.fn();
  story.addEventListener("keydown", advance);
  pause.update();
  story.focus();
  pressKey([pause.keyboard], "P");
  await settle();
  expect(scenes.pause.mock.calls.map(([key]) => key)).toEqual(["opening", "zoneIntroduction"]);
  expect(advance).not.toHaveBeenCalled();
  expect(modalInput(opening as never).accepts()).toBe(false);
  tap(pause.button(TEXT.pause.resume));
  expect(scenes.resume.mock.calls.map(([key]) => key)).toEqual(["opening", "zoneIntroduction"]);
  expect(modalInput(opening as never).accepts()).toBe(true);
  story.remove();
});

it("ends a paused room for the title without resuming its already-paused zone", async () => {
  const { active, pause, paused, scenes } = content();
  active.clear();
  active.add("room");
  paused.add("zone");
  pause.update();
  tap(pause.pauseButton);
  await settle();
  tap(pause.button(TEXT.pause.home));
  expect(scenes.stop.mock.calls.map(([key]) => key)).toEqual(["room", "zone"]);
  expect(scenes.resume).not.toHaveBeenCalled();
  expect(coverZone).toHaveBeenCalledWith("room", false);
  expect(scenes.launch).toHaveBeenCalledExactlyOnceWith("start");
});
