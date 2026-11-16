// @vitest-environment happy-dom
import { EventEmitter } from "node:events";

import type { Game } from "phaser";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const captures = vi.hoisted(() => ({ pending: [] as Promise<void>[] }));
const dom = vi.hoisted(() => ({ layer: undefined as unknown }));
const offer = vi.hoisted(() => ({
  defer: vi.fn(),
  listener: undefined as ((shown: boolean) => void) | undefined,
}));
vi.mock("phaser", () => ({ Core: { Events: { POST_RENDER: "postrender" } }, Scene: class {} }));
vi.mock("../ui/input/frameTurn.ts", () => ({ FRAME_TURN: { onChange: () => () => {} } }));
vi.mock("../pwa/index.ts", () => ({
  PHONE_EVENTS: { backPressed: "phone-back" },
  coverZone: vi.fn(),
  startWakeLock: vi.fn(),
  stopWakeLock: vi.fn(),
  updateOffer: {
    defer: offer.defer,
    subscribe: (listener: (shown: boolean) => void) => {
      offer.listener = listener;
      listener(false);
      return () => {
        offer.listener = undefined;
      };
    },
  },
  zoneShown: vi.fn(),
}));
vi.mock("./save.ts", () => ({ activeSkill: () => undefined, savedSkills: () => [] }));
vi.mock("./modalBackdrop.ts", () => ({
  showModalBackdrop: () => ({
    destroy: vi.fn(),
    ready: captures.pending.shift() ?? Promise.resolve(),
    setVisible: vi.fn(),
  }),
}));
vi.mock("./domUi.ts", () => ({
  artFrameUrl: () => Promise.resolve("blob:glyph"),
  sceneDomUi: () => dom.layer,
}));

import { TEXT } from "../data/text.ts";
import { createUiLayer, type UiLayer } from "../ui/index.ts";
import { modalInput } from "./modalInput.ts";
import { createPauseScene, press, pressKey, settle, tap } from "./pauseFixture.ts";
import { installUpdateModalBridge } from "./UpdateScene.ts";

let layer: UiLayer;
const stop: (() => void)[] = [];
beforeEach(() => {
  captures.pending = [];
  offer.defer.mockReset().mockImplementation(() => offer.listener?.(false));
  layer = createUiLayer([], document);
  dom.layer = layer;
  document.body.append(layer.element);
});
afterEach(() => {
  stop.splice(0).forEach((close) => close());
  layer.dispose();
});

function menu(initial: string) {
  const active = new Set([initial, "pause"]),
    paused = new Set<string>();
  const game = { events: new EventEmitter() };
  const owners = new Map<
    string,
    { events: EventEmitter; game: typeof game; pausable: () => boolean }
  >();
  let pausable = true;
  const get = (key: string) => {
    if (key === "zone") {
      return { playCovered: () => false, skillState: () => undefined };
    }
    if (!owners.has(key)) {
      owners.set(key, { events: new EventEmitter(), game, pausable: () => pausable });
    }
    return owners.get(key)!;
  };
  const scenes = {
    bringToTop: vi.fn(),
    get,
    isActive: (key: string) => active.has(key),
    isPaused: (key: string) => paused.has(key),
    key: "pause",
    launch: vi.fn((key: string) => active.add(key)),
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
      owners.get(key)?.events.emit("shutdown");
    }),
  };
  const pause = createPauseScene(game, scenes);
  stop.push(() => {
    pause.events.emit("shutdown");
    owners.forEach((owner) => owner.events.emit("shutdown"));
    game.events.emit("destroy");
  });
  const card = (key: string) => {
    active.add(key);
    const owner = get(key) as { events: EventEmitter; game: typeof game };
    modalInput(owner as never).open();
    const root = document.createElement("section"),
      button = document.createElement("button");
    button.textContent = key;
    root.append(button);
    const unmount = layer.mount(10, root);
    const close = layer.modals.open({}, root);
    owner.events.once("shutdown", () => {
      close();
      unmount();
    });
    stop.push(close);
    button.focus();
    pause.update();
    return { button, close, owner, root };
  };
  return {
    active,
    card,
    game,
    pause,
    paused,
    scenes,
    setPausable: (value: boolean) => {
      pausable = value;
    },
  };
}

it("opens the Start Menu with bottom-primary Close and returns focus without changing Start", async () => {
  const f = menu("start");
  const origin = document.createElement("button");
  document.body.append(origin);
  origin.focus();
  f.pause.update();
  expect(f.pause.pauseButton.getAttribute("aria-label")).toBe(TEXT.menu.button);
  tap(f.pause.pauseButton);
  await settle();
  expect(f.pause.dialog.querySelector(".ui-card-title")?.textContent).toBe(TEXT.menu.title);
  const rows = [...f.pause.dialog.querySelectorAll<HTMLButtonElement>(".ui-text-button")].filter(
    (button) => !button.hidden,
  );
  expect(rows.map((button) => button.textContent)).toEqual([
    TEXT.start.achievements,
    TEXT.pause.settings,
    TEXT.pause.close,
  ]);
  expect(rows.at(-1)?.classList.contains("ui-text-button-primary")).toBe(true);
  expect(document.activeElement).toBe(f.pause.dialog);
  const names = Array.from({ length: 5 }, () => {
    pressKey([], "Tab");
    return (
      document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.textContent
    );
  });
  expect(names).toEqual([
    TEXT.start.achievements,
    TEXT.pause.settings,
    TEXT.pause.close,
    TEXT.pause.close,
    TEXT.start.achievements,
  ]);
  f.pause.dialog.focus();
  pressKey([f.pause.keyboard], "Enter");
  expect(f.active.has("start")).toBe(true);
  expect(f.scenes.resume).toHaveBeenCalledExactlyOnceWith("start");
  expect(document.activeElement).toBe(origin);
  origin.remove();
});

it("keeps Menu covered by required Death without changing its scope, focus or held zone", async () => {
  const f = menu("death");
  f.paused.add("zone");
  const death = f.card("death");
  expect(death.root.inert).toBe(false);
  expect(f.pause.pauseButton.closest("[inert]")).not.toBeNull();
  tap(f.pause.pauseButton);
  await settle();
  expect(modalInput(death.owner as never).accepts()).toBe(true);
  expect(f.pause.dialog.closest<HTMLElement>(".ui-card-scene")!.hidden).toBe(true);
  expect(f.paused.has("zone")).toBe(true);
  expect(document.activeElement).toBe(death.button);
  expect(f.scenes.pause).not.toHaveBeenCalled();
});

it("retains the existing Settings subview across Menu", async () => {
  const f = menu("zone");
  tap(f.pause.pauseButton);
  await settle();
  tap(f.pause.button(TEXT.pause.settings));
  const settings = f.card("settings");
  tap(f.pause.pauseButton);
  await settle();
  tap(f.pause.button(TEXT.pause.settings));
  expect(f.scenes.launch).toHaveBeenCalledExactlyOnceWith("settings", { opener: "pause" });
  expect(document.activeElement).toBe(settings.button);
  expect(modalInput(settings.owner as never).accepts()).toBe(true);
  expect(f.paused.has("zone")).toBe(true);
  settings.close();
  modalInput(settings.owner as never).close();
  f.active.delete("settings");
  f.pause.scene.settingsClosed();
  tap(f.pause.button(TEXT.pause.resume));
  expect(f.active.has("zone")).toBe(true);
});

it("invalidates held entry gestures on modal changes and removes the sole entry on shutdown", async () => {
  const f = menu("map");
  const held = press(f.pause.pauseButton);
  f.card("death");
  held.lift();
  await settle();
  expect(f.scenes.pause).not.toHaveBeenCalled();
  const entry = f.pause.pauseButton;
  f.pause.events.emit("shutdown");
  expect(entry.isConnected).toBe(false);
  tap(entry);
  await settle();
  expect(f.scenes.pause).not.toHaveBeenCalled();
});

it("keeps Menu covered through Update and retains the existing defer route before Home", async () => {
  const f = menu("zone");
  const sceneManager = {
    ...f.scenes,
    getScenes: () => [...f.active].map((key) => ({ scene: { key } })),
    start: (key: string) => f.active.add(key),
  };
  installUpdateModalBridge(Object.assign(f.game, { scene: sceneManager }) as unknown as Game);
  offer.listener!(true);
  expect(f.scenes.pause).toHaveBeenCalledWith("zone");
  expect(f.scenes.pause).not.toHaveBeenCalledWith("pause");
  const update = f.card("update");
  tap(f.pause.pauseButton);
  await settle();
  expect(document.activeElement).toBe(update.button);
  expect(offer.defer).not.toHaveBeenCalled();
  expect(f.pause.dialog.closest<HTMLElement>(".ui-card-scene")!.hidden).toBe(true);
  offer.defer();
  f.pause.update();
  expect(f.active.has("update")).toBe(false);
  expect(update.root.isConnected).toBe(false);
  tap(f.pause.pauseButton);
  await settle();
  tap(f.pause.button(TEXT.pause.home));
  expect(offer.defer).toHaveBeenCalledTimes(2);
  expect(f.scenes.launch).toHaveBeenCalledWith("start");
  expect(f.paused.has("update")).toBe(false);
});

it("restores Pause after Update covers it without allowing a covered Menu visit", async () => {
  const f = menu("zone");
  tap(f.pause.pauseButton);
  await settle();
  const update = f.card("update");
  expect(f.pause.dialog.closest<HTMLElement>(".ui-card-scene")!.hidden).toBe(true);
  tap(f.pause.pauseButton);
  await settle();
  expect(document.activeElement).toBe(update.button);
  expect(f.pause.dialog.querySelector(".ui-card-title")?.textContent).toBe(TEXT.pause.title);
  expect(f.paused.has("zone")).toBe(true);
  f.active.delete("update");
  update.close();
  modalInput(update.owner as never).close();
  f.pause.update();
  expect(f.pause.dialog.closest<HTMLElement>(".ui-card-scene")!.hidden).toBe(false);
  tap(f.pause.button(TEXT.pause.resume));
  expect(f.active.has("zone")).toBe(true);
  expect(f.scenes.resume.mock.calls.filter(([key]) => key === "zone")).toHaveLength(1);
});

it("fences unready sources and invalidates entry holds across capture readiness", async () => {
  const f = menu("map");
  const source = f.scenes.get("map");
  const input = modalInput(source as never);
  input.ready(false);
  f.pause.update();
  expect(f.pause.pauseButton.disabled).toBe(true);
  input.ready(true);
  f.pause.update();
  const held = press(f.pause.pauseButton);
  input.ready(false);
  input.ready(true);
  held.lift();
  await settle();
  expect(f.scenes.pause).not.toHaveBeenCalled();
});

it("refuses an old capture completion after the menu owner restarts into a new pending visit", async () => {
  let oldReady = () => {},
    newReady = () => {};
  captures.pending.push(
    new Promise<void>((resolve) => {
      oldReady = resolve;
    }),
    new Promise<void>((resolve) => {
      newReady = resolve;
    }),
  );
  const f = menu("map");
  tap(f.pause.pauseButton);
  f.pause.events.emit("shutdown");
  f.pause.scene.create();
  const entry = document.querySelector<HTMLButtonElement>(".pause-button")!;
  tap(entry);
  const card = document.querySelector<HTMLElement>(".pause-scene .ui-card-scene")!;
  oldReady();
  await settle();
  expect(card.hidden).toBe(true);
  newReady();
  await settle();
  expect(card.hidden).toBe(false);
  expect(document.querySelectorAll(".pause-button")).toHaveLength(1);
});

it("uses Menu for an active story phase that declines Pause, without advancing that phase", async () => {
  const f = menu("dialogue");
  f.setPausable(false);
  f.pause.update();
  expect(f.pause.pauseButton.getAttribute("aria-label")).toBe(TEXT.menu.button);
  tap(f.pause.pauseButton);
  await settle();
  expect(f.pause.dialog.querySelector(".ui-card-title")?.textContent).toBe(TEXT.menu.title);
  tap(f.pause.button(TEXT.pause.close));
  expect(f.scenes.resume).toHaveBeenCalledExactlyOnceWith("dialogue");
  expect(f.scenes.launch).not.toHaveBeenCalled();
});

it("keeps Settings beneath Update and returns through its existing defer route", async () => {
  const f = menu("zone");
  tap(f.pause.pauseButton);
  await settle();
  tap(f.pause.button(TEXT.pause.settings));
  const settings = f.card("settings");
  const sceneManager = {
    ...f.scenes,
    getScenes: () => [...f.active].map((key) => ({ scene: { key } })),
    start: (key: string) => f.active.add(key),
  };
  installUpdateModalBridge(Object.assign(f.game, { scene: sceneManager }) as unknown as Game);
  offer.listener!(true);
  const update = f.card("update");
  tap(f.pause.pauseButton);
  await settle();
  expect(document.activeElement).toBe(update.button);
  expect(offer.defer).not.toHaveBeenCalled();
  offer.defer();
  expect(f.scenes.launch).toHaveBeenCalledExactlyOnceWith("settings", { opener: "pause" });
  expect(offer.defer).toHaveBeenCalledOnce();
  expect(f.active.has("settings")).toBe(true);
  expect(f.paused.has("zone")).toBe(true);
  expect(document.activeElement).toBe(settings.button);
});

it.each(["start", "map"])(
  "opens Achievements from %s Menu and restores its action focus and held subset",
  async (source) => {
    const f = menu(source);
    f.paused.add("zone");
    f.pause.update();
    tap(f.pause.pauseButton);
    await settle();
    const action = f.pause.button(TEXT.start.achievements);
    action.focus();
    tap(action);
    expect(f.scenes.launch).toHaveBeenCalledExactlyOnceWith("achievements", { opener: "pause" });
    const achievements = f.card("achievements");
    expect(modalInput(f.pause.scene).accepts()).toBe(false);
    tap(f.pause.pauseButton);
    await settle();
    tap(f.pause.button(TEXT.start.achievements));
    expect(f.scenes.launch).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(achievements.button);
    expect(modalInput(achievements.owner as never).accepts()).toBe(true);
    const back = vi.fn(() => {
      achievements.close();
      modalInput(achievements.owner as never).close();
      f.active.delete("achievements");
      f.pause.scene.achievementsClosed();
    });
    Object.assign(achievements.owner, { back });
    window.dispatchEvent(new Event("phone-back"));
    expect(back).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(action);
    expect(modalInput(f.pause.scene).accepts()).toBe(true);
    tap(f.pause.button(TEXT.pause.close));
    expect(f.active.has(source)).toBe(true);
    expect(f.paused.has("zone")).toBe(true);
  },
);

it("keeps gameplay Pause actions unchanged and resumes without offering Achievements", async () => {
  const f = menu("zone");
  tap(f.pause.pauseButton);
  await settle();
  const rows = [...f.pause.dialog.querySelectorAll<HTMLButtonElement>(".ui-text-button")].filter(
    (button) => !button.hidden,
  );
  expect(rows.map((button) => button.textContent)).toEqual([
    TEXT.pause.settings,
    TEXT.pause.home,
    TEXT.pause.resume,
  ]);
  tap(f.pause.button(TEXT.pause.resume));
  expect(f.active.has("zone")).toBe(true);
  expect(f.scenes.launch).not.toHaveBeenCalled();
});

it("preserves originating action focus when returning from Achievements and then Settings", async () => {
  const f = menu("start");
  tap(f.pause.pauseButton);
  await settle();
  const achievementsAction = f.pause.button(TEXT.start.achievements);
  achievementsAction.focus();
  tap(achievementsAction);
  const achievements = f.card("achievements");
  tap(f.pause.pauseButton);
  await settle();
  expect(document.activeElement).toBe(achievements.button);
  achievements.close();
  modalInput(achievements.owner as never).close();
  f.active.delete("achievements");
  f.pause.scene.achievementsClosed();
  expect(document.activeElement).toBe(achievementsAction);
  const settingsAction = f.pause.button(TEXT.pause.settings);
  settingsAction.focus();
  tap(settingsAction);
  const settings = f.card("settings");
  settings.close();
  modalInput(settings.owner as never).close();
  f.active.delete("settings");
  f.pause.scene.settingsClosed();
  expect(document.activeElement).toBe(settingsAction);
  tap(f.pause.button(TEXT.pause.close));
  expect(f.active.has("start")).toBe(true);
});
