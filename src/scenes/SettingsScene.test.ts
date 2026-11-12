// @vitest-environment happy-dom
import { EventEmitter } from "node:events";

import type { InstallState } from "@andornaut/game-kit/web/pwa/installState";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const gate = vi.hoisted(() => ({
  accepts: vi.fn(() => true),
  capture: vi.fn(),
  invalidate: vi.fn(),
  open: vi.fn(),
}));
const dom = vi.hoisted(() => ({ layer: undefined as undefined | object }));
const offer = vi.hoisted(() => ({
  install: vi.fn(() => Promise.resolve("steps")),
  onChange: vi.fn(() => () => undefined),
  state: vi.fn((): InstallState => "installed"),
  stepsKind: "ios",
}));
const backdrop = vi.hoisted(() => vi.fn(() => ({ ready: Promise.resolve() })));
vi.mock("phaser", () => ({ Scene: class {} }));
vi.mock("../pwa/installOffer.ts", () => ({ installOffer: () => offer }));
vi.mock("./modalInput.ts", () => ({ modalInput: () => gate }));
vi.mock("./modalBackdrop.ts", () => ({ showModalBackdrop: backdrop }));
vi.mock("./cardParts.ts", async () => {
  const { default: palette } = await import("../../public/art/palette.json");
  return {
    paletteColour: (_scene: unknown, name: keyof typeof palette.colours) =>
      Number.parseInt(palette.colours[name].slice(1), 16),
  };
});
vi.mock("./domUi.ts", () => ({
  artFrameUrl: (_scene: unknown, art: string) => Promise.resolve(`blob:${art}`),
  mountSceneView: (scene: { events: EventEmitter }, view: HTMLElement) => {
    const unmount = (dom.layer as UiLayer).mount(0, view);
    scene.events.once("shutdown", unmount);
    return unmount;
  },
  sceneDomUi: () => dom.layer,
}));

import { TEXT } from "../data/text.ts";
import { createUiLayer, reducedMotion, touchSettingShown, type UiLayer } from "../ui/index.ts";
import { SettingsScene } from "./SettingsScene.ts";

const WORDS = TEXT.settings;
const SWITCHES = [WORDS.moveControls, WORDS.actionButtons, WORDS.reducedMotion];
let layer: UiLayer;

beforeEach(() => {
  vi.clearAllMocks();
  gate.accepts.mockReturnValue(true);
  gate.capture.mockImplementation(() => () => gate.accepts());
  offer.state.mockReturnValue("installed");
  layer = createUiLayer([], document);
  document.body.append(layer.element);
  dom.layer = layer;
});

afterEach(() => {
  layer.dispose();
});

// Lets the card's dim, icons and install flow resolve.
const settle = () =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

// The settings card opened by opener, once its dim and icons are ready, with the Install row
// where the game can be installed.
async function openCard(opener = "start", install = false) {
  offer.state.mockReturnValue(install ? "steps" : "installed");
  const events = new EventEmitter();
  const owner = { setTouchSetting: vi.fn(), settingsClosed: vi.fn() };
  const stop = vi.fn();
  const scene = Object.assign(new SettingsScene(), {
    events,
    scene: { get: () => owner, isActive: () => true, restart: vi.fn(), stop },
    sys: { isActive: () => true },
    textures: { exists: () => true },
  });
  scene.init({ opener });
  scene.create();
  await settle();
  const [dialog, steps] = document.querySelectorAll<HTMLElement>("[role=dialog]");
  const name = (element: Element | null) =>
    element?.getAttribute("aria-label") ??
    document.getElementById(element?.getAttribute("aria-labelledby") ?? "")?.textContent ??
    element?.textContent;
  const control = (label: string) =>
    [...document.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => !button.closest("[hidden]") && name(button) === label,
    )!;
  const key = (value: string, options: KeyboardEventInit = {}) =>
    (document.activeElement ?? document.body).dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: value, ...options }),
    );
  const focused = () => name(document.activeElement);
  return { control, dialog: dialog!, events, focused, key, owner, scene, steps: steps!, stop };
}

it("shows a switch for each setting named from TEXT, then the build label, focused on the card", async () => {
  const { dialog } = await openCard();
  const switches = [...dialog.querySelectorAll("[role=switch]")];
  expect({
    build: dialog.querySelector(".settings-build")?.textContent,
    checked: switches.map((element) => element.getAttribute("aria-checked")),
    focused: document.activeElement === dialog,
    icons: [...dialog.querySelectorAll("img")].map((icon) => icon.getAttribute("src")),
    install: dialog.querySelector(".settings-install"),
    name: document.getElementById(dialog.getAttribute("aria-labelledby") ?? "")?.textContent,
    switches: switches.map(
      (element) => document.getElementById(element.getAttribute("aria-labelledby")!)?.textContent,
    ),
  }).toEqual({
    build: expect.stringContaining(__APP_VERSION__) as unknown,
    checked: [
      touchSettingShown("moveControls"),
      touchSettingShown("actionButtons"),
      reducedMotion(window),
    ].map(String),
    focused: true,
    icons: ["blob:icon-reduced-motion"],
    install: null,
    name: WORDS.title,
    switches: SWITCHES,
  });
});

// Each touch row draws the controls it shows or hides as decorative inline icons, and its note,
// under its label, describes its switch.
it("notes under each touch row's label that touch still works, describing its switch", async () => {
  const { control } = await openCard();
  const row = (label: string) => {
    const button = control(label);
    const note = document.getElementById(button.getAttribute("aria-describedby") ?? "");
    const icons = [...button.querySelectorAll<HTMLElement>(".ui-action-help-icon")];
    return {
      decorative: icons.every(
        (icon) => icon.closest("[aria-hidden=true]") !== null && !icon.hasAttribute("aria-label"),
      ),
      icons: icons.map((icon) => icon.dataset.action),
      name: [...button.querySelector(".settings-name")!.children].map((line) => line.textContent),
      note: note && button.contains(note) ? note.textContent : null,
    };
  };
  expect([WORDS.moveControls, WORDS.actionButtons, WORDS.reducedMotion].map(row)).toEqual([
    {
      decorative: true,
      icons: ["move"],
      name: [WORDS.moveControls, WORDS.touchStillWorks],
      note: WORDS.touchStillWorks,
    },
    {
      decorative: true,
      icons: ["use", "jump"],
      name: [WORDS.actionButtons, WORDS.touchStillWorks],
      note: WORDS.touchStillWorks,
    },
    { decorative: true, icons: [], name: [WORDS.reducedMotion], note: null },
  ]);
});

it("moves the keyboard's focus through the rows, Install, then the close X, wrapping", async () => {
  const { focused, key } = await openCard("start", true);
  const steps = (values: readonly string[]) =>
    values.map((value) => {
      key(value);
      return focused();
    });
  expect(
    steps(["ArrowDown", "Tab", "ArrowDown", "ArrowDown", "Tab", "ArrowDown", "ArrowUp"]),
  ).toEqual([...SWITCHES, WORDS.install, WORDS.close, WORDS.moveControls, WORDS.close]);
});

it("toggles and saves Reduced motion on a press, never through the opener", async () => {
  const { control, owner } = await openCard();
  const motion = reducedMotion(window);
  control(WORDS.reducedMotion).click();
  expect({
    checked: control(WORDS.reducedMotion).getAttribute("aria-checked"),
    motion: reducedMotion(window),
    saved: localStorage.getItem("chibis-way-home.reduced-motion"),
    touch: owner.setTouchSetting.mock.calls.length,
  }).toEqual({ checked: String(!motion), motion: !motion, saved: motion ? "off" : "on", touch: 0 });
});

it("takes its own scope over the pause card, and passes each touch setting's change to it", async () => {
  const { control, key, owner } = await openCard("pause");
  control(WORDS.actionButtons).focus();
  key("Enter");
  key("Enter", { repeat: true });
  expect(owner.setTouchSetting).toHaveBeenCalledExactlyOnceWith(
    "actionButtons",
    !touchSettingShown("actionButtons"),
  );
  // Over the pause card's dim it opens its own scope over the pause card's.
  expect({ backdrop: backdrop.mock.calls.length, scopes: gate.open.mock.calls.length }).toEqual({
    backdrop: 0,
    scopes: 1,
  });
});

it("keeps the gate's refusals: no toggle or close while the gate refuses", async () => {
  const { control, key, owner } = await openCard();
  const motion = reducedMotion(window);
  gate.accepts.mockReturnValue(false);
  control(WORDS.reducedMotion).click();
  control(WORDS.close).click();
  key("Escape");
  expect({ closed: owner.settingsClosed.mock.calls.length, motion: reducedMotion(window) }).toEqual(
    { closed: 0, motion },
  );
});

it.each(["Escape", "P", "p"])("closes on %s, once", async (value) => {
  const { key, owner, stop } = await openCard();
  key(value);
  key(value, { repeat: true });
  expect(owner.settingsClosed).toHaveBeenCalledOnce();
  expect(stop).toHaveBeenCalledExactlyOnceWith();
});

it("closes on the close X and on back, once", async () => {
  const { control, key, owner, scene } = await openCard();
  control(WORDS.close).focus();
  key("Enter");
  scene.back();
  expect(owner.settingsClosed).toHaveBeenCalledOnce();
});

it("closes on a tap outside the card, never on one that lands on it or travels", async () => {
  const { dialog, owner } = await openCard();
  const outside = document.querySelector<HTMLElement>(".ui-backdrop")!;
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
  tap(outside, 40);
  expect(owner.settingsClosed).not.toHaveBeenCalled();
  tap(outside, 0);
  expect(owner.settingsClosed).toHaveBeenCalledOnce();
});

it("shows the install steps in the card's place, which Escape, back and its X close in turn", async () => {
  const { control, dialog, focused, key, owner, scene, steps } = await openCard("pause", true);
  control(WORDS.install).focus();
  key("Enter");
  await settle();
  const { steps: text, title } = WORDS.installSteps.ios;
  const showing = () => ({ settings: !dialog.hidden, steps: !steps.hidden });
  expect({
    focused: focused(),
    glyph: steps.querySelector("img")?.getAttribute("src"),
    name: document.getElementById(steps.getAttribute("aria-labelledby") ?? "")?.textContent,
    showing: showing(),
    text: document.getElementById(steps.getAttribute("aria-describedby") ?? "")?.textContent,
  }).toEqual({
    focused: WORDS.close,
    glyph: "blob:icon-ios-share",
    name: title,
    showing: { settings: false, steps: true },
    text,
  });
  key("Escape");
  expect({ focused: focused(), showing: showing() }).toEqual({
    focused: WORDS.install,
    showing: { settings: true, steps: false },
  });
  key("Enter");
  await settle();
  scene.back();
  key("Enter");
  await settle();
  key("Enter");
  expect({ closed: owner.settingsClosed.mock.calls.length, showing: showing() }).toEqual({
    closed: 0,
    showing: { settings: true, steps: false },
  });
  expect(gate.invalidate).toHaveBeenCalledTimes(6);
  scene.back();
  expect(owner.settingsClosed).toHaveBeenCalledOnce();
});

it("removes the card and gives back the keys when the scene shuts down", async () => {
  const { events } = await openCard();
  events.emit("shutdown");
  expect(document.querySelector("[role=dialog]")).toBeNull();
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Tab" });
  document.body.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(false);
});

// Openers can forward back before Phaser processes a queued scene launch.
it("ignores back before its scene starts", () => {
  const scene = Object.assign(new SettingsScene(), { sys: { isActive: () => false } });
  expect(() => scene.back()).not.toThrow();
});
