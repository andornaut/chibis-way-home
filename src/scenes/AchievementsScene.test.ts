// @vitest-environment happy-dom
import { EventEmitter } from "node:events";

import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { ACHIEVEMENT_IDS, type AchievementEntry } from "../progress/index.ts";

const saved = vi.hoisted(() => ({ entries: [] as AchievementEntry[] }));
const gate = vi.hoisted(() => ({
  accepts: vi.fn(() => true),
  capture: vi.fn(),
  invalidate: vi.fn(),
  subscribe: vi.fn(),
}));
const dom = vi.hoisted(() => ({ layer: undefined as undefined | object }));
vi.mock("phaser", () => ({ Scene: class {} }));
vi.mock("./save.ts", () => ({ achievementCard: () => saved.entries }));
vi.mock("./modalInput.ts", async (original) => ({
  ...(await original<typeof import("./modalInput.ts")>()),
  modalInput: () => gate,
}));
vi.mock("./modalBackdrop.ts", () => ({ showModalBackdrop: () => ({ ready: Promise.resolve() }) }));
vi.mock("./AchievementNoticeScene.ts", () => ({
  achievementIconFrame: (_scene: unknown, earned: boolean, id: string) =>
    `${id}-${earned ? "unlocked" : "locked"}`,
}));
vi.mock("./domUi.ts", () => ({
  artFrameUrl: (_scene: unknown, art: string, frame: string) =>
    Promise.resolve(`blob:${art}/${frame}`),
  mountSceneView: (scene: { events: EventEmitter }, view: HTMLElement) => {
    const unmount = (dom.layer as UiLayer).mount(0, view);
    scene.events.once("shutdown", unmount);
    return unmount;
  },
  sceneDomUi: () => dom.layer,
}));

import { TEXT } from "../data/text.ts";
import { TOUCH } from "../data/touch.ts";
import { achievementsPerPage, bindGameActions, createUiLayer, type UiLayer } from "../ui/index.ts";
import { AchievementsScene } from "./AchievementsScene.ts";

const WORDS = TEXT.achievements;
const PER_PAGE = achievementsPerPage();
const PAGES = Math.ceil(ACHIEVEMENT_IDS.length / PER_PAGE);
let layer: UiLayer;

beforeEach(() => {
  vi.clearAllMocks();
  gate.accepts.mockReturnValue(true);
  gate.capture.mockImplementation(() => () => gate.accepts());
  saved.entries = ACHIEVEMENT_IDS.map((id, index) =>
    index === 0
      ? { earned: true, id }
      : { earned: false, id, ...(index === 1 && { progress: { have: 2, need: 6 } }) },
  );
  layer = createUiLayer([], document);
  document.body.append(layer.element);
  dom.layer = layer;
});

afterEach(() => {
  vi.useRealTimers();
  layer.dispose();
});

// Lets the card's dim and icons resolve.
const settle = () =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

// The Achievements card opened over the start screen, once its dim and icons are ready.
async function openCard() {
  const events = new EventEmitter();
  const achievementsClosed = vi.fn(),
    stop = vi.fn();
  const scene = Object.assign(new AchievementsScene(), {
    events,
    scene: { get: () => ({ achievementsClosed }), stop },
    sys: { isActive: () => true },
  });
  scene.init({ opener: "start" });
  scene.create();
  await settle();
  const dialog = document.querySelector<HTMLElement>("[role=dialog]")!;
  const button = (name: string) =>
    [...dialog.querySelectorAll("button")].find(
      (element) => (element.getAttribute("aria-label") ?? element.textContent) === name,
    )!;
  const key = (value: string, options: KeyboardEventInit = {}) =>
    (document.activeElement ?? document.body).dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: value, ...options }),
    );
  const shown = () =>
    [...dialog.querySelectorAll<HTMLElement>("li")]
      .filter(({ hidden }) => !hidden)
      .map((item) => item.querySelector(".achievements-title")?.textContent);
  const focused = () =>
    document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.textContent;
  return { achievementsClosed, button, dialog, events, focused, key, scene, shown, stop };
}

const titles = (page: number) =>
  ACHIEVEMENT_IDS.slice(page * PER_PAGE, (page + 1) * PER_PAGE).map(
    (id) => WORDS.entries[id].title,
  );

it("shows every entry as a list named from TEXT, a page at a time, focused on the card", async () => {
  const { button, dialog, shown } = await openCard();
  const named = (id: string | null) => document.getElementById(id ?? "")?.textContent;
  expect({
    entries: dialog.querySelectorAll("ul > li").length,
    focused: document.activeElement === dialog,
    modal: dialog.getAttribute("aria-modal"),
    name: named(dialog.getAttribute("aria-labelledby")),
    page: dialog.querySelector("[aria-live=polite]")?.textContent,
    previous: button(WORDS.pages.previous).disabled,
    shown: shown(),
  }).toEqual({
    entries: ACHIEVEMENT_IDS.length,
    focused: true,
    modal: "true",
    name: WORDS.cardTitle,
    page: WORDS.pages.page.replace("{page}", "1").replace("{pages}", String(PAGES)),
    previous: true,
    shown: titles(0),
  });
});

it("states each entry's state in its icon's text and shows a locked entry's progress", async () => {
  const { dialog } = await openCard();
  const items = [...dialog.querySelectorAll("li")].slice(0, 3);
  expect(
    items.map((item) => ({
      earned: item.hasAttribute("data-earned"),
      icon: item.querySelector("img")?.getAttribute("src"),
      state: item.querySelector("img")?.alt,
      text: item.textContent,
    })),
  ).toEqual(
    ACHIEVEMENT_IDS.slice(0, 3).map((id, index) => {
      const { description, title } = WORDS.entries[id];
      const earned = index === 0;
      return {
        earned,
        icon: `blob:icon-achievement/${id}-${earned ? "unlocked" : "locked"}`,
        state: earned ? WORDS.unlocked : WORDS.locked,
        text: `${title}${index === 1 ? "2/6" : ""}${description}`,
      };
    }),
  );
});

it("moves the keyboard's focus through the enabled pager buttons, Back and the close X, wrapping", async () => {
  const { button, focused, key } = await openCard();
  const steps = (values: readonly string[]) =>
    values.map((value) => {
      key(value);
      return focused();
    });
  const { next, previous } = WORDS.pages;
  expect(steps(["Tab", "ArrowRight", "Tab", "ArrowLeft"])).toEqual([
    next,
    WORDS.back,
    WORDS.close,
    WORDS.back,
  ]);
  button(next).focus();
  key("Enter");
  expect(steps(["Tab", "Tab", "Tab"])).toEqual([WORDS.back, WORDS.close, previous]);
});

it("pages with Next and Previous, and moves the focus off Next on the last page", async () => {
  const { button, focused, key, shown } = await openCard();
  const { next, previous } = WORDS.pages;
  button(next).focus();
  for (let page = 1; page < PAGES; page += 1) {
    key("Enter");
    expect(shown()).toEqual(titles(page));
  }
  expect({ focused: focused(), next: button(next).disabled }).toEqual({
    focused: previous,
    next: true,
  });
  expect(gate.invalidate).toHaveBeenCalledTimes(PAGES - 1);
  key("Enter");
  expect(shown()).toEqual(titles(PAGES - 2));
});

it("keeps the gate's refusals: no page change or close while the gate refuses", async () => {
  const { achievementsClosed, button, key, shown } = await openCard();
  gate.accepts.mockReturnValue(false);
  button(WORDS.pages.next).click();
  button(WORDS.close).click();
  button(WORDS.back).click();
  key("Escape");
  expect({ closed: achievementsClosed.mock.calls.length, shown: shown() }).toEqual({
    closed: 0,
    shown: titles(0),
  });
});

it.each(["Escape", "P", "p"])("closes on %s", async (value) => {
  const { achievementsClosed, key, stop } = await openCard();
  key(value);
  key(value, { repeat: true });
  expect(achievementsClosed).toHaveBeenCalledOnce();
  expect(stop).toHaveBeenCalledExactlyOnceWith();
});

it("closes on the close X and on back, once", async () => {
  const { achievementsClosed, button, key, scene } = await openCard();
  button(WORDS.close).focus();
  key("Enter");
  scene.back();
  expect(achievementsClosed).toHaveBeenCalledOnce();
});

it("closes on a tap outside the card, never on one that lands on it or travels", async () => {
  const { achievementsClosed, dialog } = await openCard();
  const backdrop = document.querySelector<HTMLElement>(".ui-backdrop")!;
  const tap = (target: HTMLElement, travel: number) => {
    target.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        button: 0,
        clientX: 5,
        clientY: 5,
        isPrimary: true,
        pointerId: 1,
      }),
    );
    target.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        button: 0,
        clientX: 5 + travel,
        clientY: 5,
        isPrimary: true,
        pointerId: 1,
      }),
    );
  };
  tap(dialog, 0);
  tap(backdrop, 40);
  expect(achievementsClosed).not.toHaveBeenCalled();
  tap(backdrop, 0);
  expect(achievementsClosed).toHaveBeenCalledOnce();
});

it("prevents compatibility mouse defaults only on eligible primary touch dismissals", async () => {
  const { achievementsClosed, button, shown } = await openCard();
  const back = button(WORDS.back);
  const close = button(WORDS.close);
  const next = button(WORDS.pages.next);
  const backdrop = document.querySelector<HTMLElement>(".ui-backdrop")!;
  const pointer = (type: string, options: PointerEventInit, target: HTMLElement) =>
    target.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        button: 0,
        cancelable: true,
        clientX: 5,
        clientY: 5,
        isPrimary: true,
        pointerId: 1,
        pointerType: "touch",
        ...options,
      }),
    );
  const prevented = (options: PointerEventInit, target: HTMLElement) => {
    const accepted = pointer("pointerdown", options, target);
    pointer("pointercancel", options, target);
    return !accepted;
  };
  gate.accepts.mockReturnValue(false);
  expect(prevented({}, back)).toBe(false);
  gate.accepts.mockReturnValue(true);
  expect({
    back: prevented({}, back),
    backdrop: prevented({}, backdrop),
    close: prevented({}, close),
    mouse: prevented({ pointerType: "mouse" }, back),
    next: prevented({}, next),
    nonPrimary: prevented({ isPrimary: false }, back),
    secondaryButton: prevented({ button: 2 }, back),
  }).toEqual({
    back: true,
    backdrop: true,
    close: true,
    mouse: false,
    next: false,
    nonPrimary: false,
    secondaryButton: false,
  });
  pointer("pointerdown", {}, next);
  pointer("pointerup", {}, next);
  expect(shown()).toEqual(titles(1));
  pointer("pointerdown", {}, back);
  pointer("pointerup", { clientX: 200 }, back);
  expect(achievementsClosed).not.toHaveBeenCalled();
  pointer("pointerdown", {}, back);
  pointer("pointerup", {}, back);
  expect(achievementsClosed).toHaveBeenCalledOnce();
});

it("never shows a disabled pager button pressed", async () => {
  const { button } = await openCard();
  const press = (target: HTMLElement) =>
    target.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, button: 0, isPrimary: true, pointerId: 1 }),
    );
  press(button(WORDS.pages.previous));
  press(button(WORDS.pages.next));
  expect({
    next: "pressed" in button(WORDS.pages.next).dataset,
    previous: "pressed" in button(WORDS.pages.previous).dataset,
  }).toEqual({ next: true, previous: false });
});

it("removes the card and gives back the keys when the scene shuts down", async () => {
  const { events } = await openCard();
  events.emit("shutdown");
  expect(document.querySelector("[role=dialog]")).toBeNull();
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Tab" });
  document.body.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(false);
});

it("never shows the card when the scene shuts down before its dim is ready", async () => {
  const events = new EventEmitter();
  const scene = Object.assign(new AchievementsScene(), {
    events,
    scene: { get: vi.fn(), stop: vi.fn() },
    sys: { isActive: () => true },
  });
  scene.init({ opener: "start" });
  scene.create();
  events.emit("shutdown");
  await settle();
  expect(document.querySelector("[role=dialog]")).toBeNull();
});

it("returns to the same opener through the bottom-right primary Back action once", async () => {
  const { achievementsClosed, button, dialog, scene, stop } = await openCard();
  const back = button(WORDS.back);
  expect(back.classList.contains("ui-text-button-primary")).toBe(true);
  expect(back.closest(".achievements-return")?.parentElement?.className).toBe(
    "achievements-footer",
  );
  expect(dialog.querySelector(".achievements-footer .achievements-pager")).not.toBeNull();
  back.click();
  scene.back();
  expect(achievementsClosed).toHaveBeenCalledOnce();
  expect(stop).toHaveBeenCalledExactlyOnceWith();
});

it("consumes a closing Back hold before release reaches the newly exposed action", async () => {
  const { achievementsClosed, button, dialog, events, stop } = await openCard();
  const root = document.createElement("div");
  const underlying = document.createElement("button");
  underlying.textContent = TEXT.start.start;
  root.append(underlying);
  const unmount = layer.mount(-1, root);
  const activate = vi.fn();
  const action = { activate, available: () => true, element: underlying };
  const dispose = bindGameActions(
    { guard: { gate }, resolve: (target) => (target === underlying ? action : null) },
    root,
  );
  stop.mockImplementation(() => events.emit("shutdown"));
  const pointer = (target: HTMLElement, type: string) =>
    target.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        button: 0,
        isPrimary: true,
        pointerId: 1,
      }),
    );
  vi.useFakeTimers();
  try {
    const back = button(WORDS.back);
    pointer(back, "pointerdown");
    vi.advanceTimersByTime(TOUCH.actionHoldMilliseconds);
    expect(achievementsClosed).toHaveBeenCalledOnce();
    expect(stop).toHaveBeenCalledOnce();
    expect(dialog.isConnected).toBe(false);
    expect(root.closest("[inert]")).toBeNull();
    pointer(underlying, "pointerup");
    underlying.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
    expect(activate).not.toHaveBeenCalled();
    expect(achievementsClosed).toHaveBeenCalledOnce();
    pointer(underlying, "pointerdown");
    pointer(underlying, "pointerup");
    underlying.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
    expect(activate).toHaveBeenCalledOnce();
  } finally {
    events.emit("shutdown");
    dispose();
    unmount();
  }
});
