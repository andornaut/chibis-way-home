// @vitest-environment happy-dom
import { EventEmitter } from "node:events";

import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { ACHIEVEMENT_IDS, type AchievementEntry } from "../progress";

const saved = vi.hoisted(() => ({ entries: [] as AchievementEntry[] }));
const gate = vi.hoisted(() => ({
  accepts: vi.fn(() => true),
  capture: vi.fn(),
  invalidate: vi.fn(),
}));
const dom = vi.hoisted(() => ({ layer: undefined as undefined | object }));
vi.mock("phaser", () => ({ Scene: class {} }));
vi.mock("../pwa", () => ({ coverZone: vi.fn() }));
vi.mock("./save", () => ({ achievementCard: () => saved.entries }));
vi.mock("./modalInput", () => ({ modalInput: () => gate }));
vi.mock("./modalBackdrop", () => ({ showModalBackdrop: () => ({ ready: Promise.resolve() }) }));
vi.mock("./AchievementNoticeScene", () => ({
  achievementIconFrame: (_scene: unknown, earned: boolean, id: string) =>
    `${id}-${earned ? "unlocked" : "locked"}`,
}));
vi.mock("./domUi", () => ({
  artFrameUrl: (_scene: unknown, art: string, frame: string) =>
    Promise.resolve(`blob:${art}/${frame}`),
  mountSceneView: (scene: { events: EventEmitter }, view: HTMLElement) => {
    const unmount = (dom.layer as UiLayer).mount(0, view);
    scene.events.once("shutdown", unmount);
    return unmount;
  },
  sceneDomUi: () => dom.layer,
}));

import { TEXT } from "../data/text";
import { achievementsPerPage, createUiLayer, type UiLayer } from "../ui";
import { AchievementsScene } from "./AchievementsScene";
import { StartScene } from "./StartScene";

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

it("moves the keyboard's focus through the enabled pager buttons then the close X, wrapping", async () => {
  const { button, focused, key } = await openCard();
  const steps = (values: readonly string[]) =>
    values.map((value) => {
      key(value);
      return focused();
    });
  const { next, previous } = WORDS.pages;
  expect(steps(["Tab", "ArrowRight", "Tab", "ArrowLeft"])).toEqual([
    next,
    WORDS.close,
    next,
    WORDS.close,
  ]);
  button(next).focus();
  key("Enter");
  expect(steps(["Tab", "Tab", "Tab"])).toEqual([WORDS.close, previous, next]);
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
      new PointerEvent("pointerdown", { bubbles: true, clientX: 5, clientY: 5, pointerId: 1 }),
    );
    target.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        clientX: 5 + travel,
        clientY: 5,
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

it("never shows a disabled pager button pressed", async () => {
  const { button } = await openCard();
  const press = (target: HTMLElement) =>
    target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1 }));
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

it("opens from the start screen with the start screen as its opener", () => {
  const launch = vi.fn();
  const scene = Object.assign(new StartScene(), {
    drawFocus: vi.fn(),
    scene: { key: "start", launch },
  }) as unknown as { act(control: "achievements"): void };
  scene.act("achievements");
  expect(launch).toHaveBeenCalledExactlyOnceWith("achievements", { opener: "start" });
});
