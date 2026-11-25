// @vitest-environment happy-dom
import { EventEmitter } from "node:events";

import type { InstallState } from "@andornaut/game-kit/runtime/web/pwa/installState";
import { FORM_ROW_STATE_CLASS } from "@andornaut/game-kit/runtime/web/ui/dom/formRow";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const gate = vi.hoisted(() => ({
  accepts: vi.fn(() => true),
  capture: vi.fn(),
  invalidate: vi.fn(),
  open: vi.fn(),
  subscribe: vi.fn(),
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
vi.mock("./modalInput.ts", async (original) => ({
  ...(await original<typeof import("./modalInput.ts")>()),
  modalInput: () => gate,
}));
vi.mock("./modalBackdrop.ts", () => ({ showModalBackdrop: backdrop }));
vi.mock("./scenePalette.ts", async () => {
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

import { DEV_TEXT } from "../data/dev.ts";
import { TEXT } from "../data/text.ts";
import { TOUCH } from "../data/touch.ts";
import {
  createUiLayer,
  fpsCounterShown,
  mountFpsCounter,
  reducedMotion,
  setFpsCounterShown,
  setTouchSettingShown,
  touchSettingShown,
  type UiLayer,
} from "../ui/index.ts";
import { SettingsScene } from "./SettingsScene.ts";

const WORDS = TEXT.settings;
const SWITCHES = [WORDS.moveControls, WORDS.actionButtons, WORDS.fps, WORDS.reducedMotion];
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
  vi.restoreAllMocks();
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
  const owner = {
    setTouchSetting: vi.fn(setTouchSettingShown),
    settingsClosed: vi.fn(),
  };
  const stop = vi.fn();
  const scene = Object.assign(new SettingsScene(), {
    events,
    scene: { get: () => owner, isActive: () => true, restart: vi.fn(), stop },
    sys: { isActive: (): boolean => true },
    textures: { exists: () => true },
  });
  scene.init({ opener });
  scene.create();
  await settle();
  const [dialog, steps] = document.querySelectorAll<HTMLElement>("[role=dialog]");
  // An element's accessible name: its label, or its text without the decorative parts.
  const name = (element: Element | null) => {
    const shown = element?.cloneNode(true) as Element | undefined;
    shown?.querySelectorAll('[aria-hidden="true"]').forEach((hidden) => hidden.remove());
    return (
      element?.getAttribute("aria-label") ??
      document.getElementById(element?.getAttribute("aria-labelledby") ?? "")?.textContent ??
      shown?.textContent
    );
  };
  const hidden = (element: Element) => element.closest("[hidden]") !== null;
  const control = (label: string) =>
    [...document.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => !button.closest("[hidden]") && name(button) === label,
    )!;
  const key = (value: string, options: KeyboardEventInit = {}) =>
    (document.activeElement ?? document.body).dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: value, ...options }),
    );
  const focused = () => name(document.activeElement);
  return {
    control,
    dialog: dialog!,
    events,
    focused,
    hidden,
    key,
    name,
    owner,
    scene,
    steps: steps!,
    stop,
  };
}

it("shows a switch for each setting named from TEXT, then the build label, focused on the card", async () => {
  const { dialog, name } = await openCard();
  const switches = [...dialog.querySelectorAll("[role=switch]")];
  expect({
    build: dialog.querySelector(".settings-build")?.textContent,
    checked: switches.map((element) => element.getAttribute("aria-checked")),
    focused: document.activeElement === dialog,
    icons: [...dialog.querySelectorAll("img")].map((icon) => icon.getAttribute("src")),
    install: [...dialog.querySelectorAll("button")].map(name).includes(WORDS.install),
    name: name(dialog),
    switches: switches.map(name),
  }).toEqual({
    build: expect.stringContaining(__APP_VERSION__) as unknown,
    checked: [
      touchSettingShown("moveControls"),
      touchSettingShown("actionButtons"),
      fpsCounterShown(),
      reducedMotion(window),
    ].map(String),
    focused: true,
    icons: ["blob:icon-reduced-motion"],
    install: false,
    name: WORDS.title,
    switches: SWITCHES,
  });
});

// Each setting's name and effect stay separate, with decorative inline touch icons where needed.
it("keeps switch descriptions separate from their accessible setting names", async () => {
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
      note: note && button.contains(note) ? note.textContent : null,
    };
  };
  const fpsIcon = control(WORDS.fps).querySelector(".settings-fps-icon");
  expect(fpsIcon?.closest("[aria-hidden]")?.getAttribute("aria-hidden")).toBe("true");
  expect(fpsIcon?.querySelector("svg")?.getAttribute("viewBox")).toBe("0 0 20 20");
  expect(fpsIcon?.querySelector("img")).toBeNull();
  expect(SWITCHES.map(row)).toEqual([
    {
      decorative: true,
      icons: ["move"],
      note: WORDS.descriptions.moveControls,
    },
    {
      decorative: true,
      icons: ["use", "jump"],
      note: WORDS.descriptions.actionButtons,
    },
    { decorative: true, icons: [], note: null },
    {
      decorative: true,
      icons: [],
      note: WORDS.descriptions.reducedMotion,
    },
  ]);
});

it("shows current state text before and after toggling without changing the setting name", async () => {
  const { control, name } = await openCard();
  for (const [label, enabled, disabled] of [
    [WORDS.moveControls, WORDS.state.shown, WORDS.state.hidden],
    [WORDS.actionButtons, WORDS.state.shown, WORDS.state.hidden],
    [WORDS.reducedMotion, WORDS.state.on, WORDS.state.off],
  ] as const) {
    const button = control(label);
    const checked = button.getAttribute("aria-checked") === "true";
    const state = button.querySelector<HTMLElement>(`.${FORM_ROW_STATE_CLASS}`)!;
    expect(state.textContent).toBe(checked ? enabled : disabled);
    button.click();
    expect(button.getAttribute("aria-checked")).toBe(String(!checked));
    expect(state.textContent).toBe(checked ? disabled : enabled);
    expect(name(button)).toBe(label);
  }
});

it.each(["tap", "hold", "keyboard"] as const)(
  "opens Install once by %s from its single labelled icon face",
  async (action) => {
    const { control, hidden, key, steps } = await openCard("pause", true);
    const install = control(WORDS.install);
    expect(install.textContent).toBe(WORDS.install);
    const icon = install.querySelector("img")!;
    expect(icon.getAttribute("src")).toBe("blob:icon-install");
    expect(icon.getAttribute("alt")).toBe("");
    expect(icon.getAttribute("aria-hidden")).toBe("true");
    vi.useFakeTimers();
    try {
      if (action === "keyboard") {
        install.focus();
        key("Enter");
        key("Enter", { repeat: true });
      } else {
        const options = {
          bubbles: true,
          button: 0,
          isPrimary: true,
          pointerId: 81,
          pointerType: "touch",
        };
        install.dispatchEvent(new PointerEvent("pointerdown", options));
        if (action === "hold") {
          await vi.advanceTimersByTimeAsync(TOUCH.actionHoldMilliseconds);
        }
        install.dispatchEvent(new PointerEvent("pointerup", options));
        install.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
      }
      await vi.advanceTimersByTimeAsync(0);
      expect(offer.install).toHaveBeenCalledOnce();
      expect(hidden(steps)).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  },
);

it("moves the keyboard's focus through the rows, Install, Back and the close X, wrapping", async () => {
  const { focused, key } = await openCard("start", true);
  const steps = (values: readonly string[]) =>
    values.map((value) => {
      key(value);
      return focused();
    });
  expect(
    steps([
      "ArrowDown",
      "Tab",
      "ArrowDown",
      "ArrowDown",
      "Tab",
      "ArrowDown",
      "ArrowDown",
      "Tab",
      "ArrowUp",
    ]),
  ).toEqual([...SWITCHES, WORDS.install, WORDS.back, WORDS.close, WORDS.moveControls, WORDS.close]);
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

it("changes only the FPS device preference and overlay from Settings", async () => {
  const deviceKey = "chibis-way-home.fps-counter";
  const saved = new Map([
    ["chibis-way-home.save", "retained-save"],
    ["chibis-way-home.save-backup", "retained-backup"],
  ]);
  for (const [key, value] of saved) {
    localStorage.setItem(key, value);
  }
  const unmount = mountFpsCounter(document, () => 59.6, WORDS.fps);
  try {
    const { control, key, owner } = await openCard("pause");
    const button = control(WORDS.fps);
    const overlay = document.querySelector<HTMLElement>(".fps-counter")!;
    expect([
      button.getAttribute("aria-checked"),
      overlay.hidden,
      localStorage.getItem(deviceKey),
    ]).toEqual(["false", true, null]);

    vi.useFakeTimers();
    button.focus();
    key("Enter");
    key("Enter", { repeat: true });
    expect([
      button.getAttribute("aria-checked"),
      overlay.hidden,
      localStorage.getItem(deviceKey),
    ]).toEqual(["true", false, "on"]);

    const touch = (type: string) =>
      button.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          button: 0,
          isPrimary: true,
          pointerId: 1,
          pointerType: "touch",
        }),
      );
    touch("pointerdown");
    await vi.advanceTimersByTimeAsync(TOUCH.actionHoldMilliseconds);
    expect(button.getAttribute("aria-checked")).toBe("false");
    touch("pointerup");
    expect([
      button.getAttribute("aria-checked"),
      overlay.hidden,
      localStorage.getItem(deviceKey),
    ]).toEqual(["false", true, null]);
    expect(owner.setTouchSetting).not.toHaveBeenCalled();
    for (const [storageKey, value] of saved) {
      expect(localStorage.getItem(storageKey)).toBe(value);
    }
  } finally {
    unmount();
    setFpsCounterShown(false);
    vi.useRealTimers();
    for (const storageKey of saved.keys()) {
      localStorage.removeItem(storageKey);
    }
  }
});

it("takes its own scope over the pause card, and passes each touch setting's change to it", async () => {
  const { control, key, owner } = await openCard("pause");
  const next = !touchSettingShown("actionButtons");
  control(WORDS.actionButtons).focus();
  key("Enter");
  key("Enter", { repeat: true });
  expect(owner.setTouchSetting).toHaveBeenCalledExactlyOnceWith("actionButtons", next);
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
  control(WORDS.back).click();
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
  tap(outside, 40);
  expect(owner.settingsClosed).not.toHaveBeenCalled();
  tap(outside, 0);
  expect(owner.settingsClosed).toHaveBeenCalledOnce();
});

it("keeps Settings painted beneath the install steps, which Escape, back and its X close in turn", async () => {
  const { control, dialog, focused, hidden, key, name, owner, scene, steps } = await openCard(
    "pause",
    true,
  );
  control(WORDS.install).focus();
  key("Enter");
  await settle();
  const { steps: text, title } = WORDS.installSteps.ios;
  const showing = () => ({ settings: !hidden(dialog), steps: !hidden(steps) });
  expect({
    focused: focused(),
    glyph: steps.querySelector("img")?.getAttribute("src"),
    name: name(steps),
    showing: showing(),
    text: document.getElementById(steps.getAttribute("aria-describedby") ?? "")?.textContent,
  }).toEqual({
    focused: WORDS.close,
    glyph: "blob:icon-ios-share",
    name: title,
    showing: { settings: true, steps: true },
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

it("keeps the Cheats entry outside Settings", async () => {
  const { dialog } = await openCard("pause");
  expect(dialog.textContent).not.toContain(DEV_TEXT.openCheats);
});

it("prevents compatibility mouse defaults only for an eligible current Settings dismissal", async () => {
  const { control, owner, scene } = await openCard("pause", true);
  const close = control(WORDS.close);
  const backdrop = document.querySelector<HTMLElement>(".ui-backdrop")!;
  const prevented = (element: HTMLElement, options: PointerEventInit = {}) => {
    const event = new PointerEvent("pointerdown", {
      bubbles: true,
      button: 0,
      cancelable: true,
      isPrimary: true,
      pointerId: 41,
      pointerType: "touch",
      ...options,
    });
    element.dispatchEvent(event);
    element.dispatchEvent(new PointerEvent("pointercancel", { bubbles: true, pointerId: 41 }));
    return event.defaultPrevented;
  };
  expect(prevented(close)).toBe(true);
  expect(prevented(control(WORDS.back))).toBe(true);
  expect(prevented(backdrop)).toBe(true);
  expect(prevented(control(WORDS.install))).toBe(false);
  expect(prevented(control(WORDS.reducedMotion))).toBe(false);
  expect(prevented(close, { pointerType: "mouse" })).toBe(false);
  expect(prevented(close, { isPrimary: false })).toBe(false);
  expect(prevented(close, { button: 2 })).toBe(false);
  gate.accepts.mockReturnValue(false);
  expect(prevented(close)).toBe(false);
  gate.accepts.mockReturnValue(true);
  vi.spyOn(scene.sys, "isActive").mockReturnValueOnce(false);
  expect(prevented(close)).toBe(false);
  close.hidden = true;
  expect(prevented(close)).toBe(false);
  close.hidden = false;
  scene.back();
  expect(owner.settingsClosed).toHaveBeenCalledOnce();
  expect(prevented(close)).toBe(false);
});

it("restores Install after a touch-opened steps card and protects its X and backdrop dismissals", async () => {
  const { control, dialog, hidden, owner, steps } = await openCard("pause", true);
  const install = control(WORDS.install);
  const back = control(WORDS.back);
  const backdrop = document.querySelector<HTMLElement>(".ui-backdrop")!;
  const close = steps.querySelector<HTMLButtonElement>(".ui-close-button")!;
  const tap = (element: HTMLElement) => {
    const options = {
      bubbles: true,
      button: 0,
      cancelable: true,
      isPrimary: true,
      pointerId: 42,
      pointerType: "touch",
    };
    const down = new PointerEvent("pointerdown", options);
    element.dispatchEvent(down);
    element.dispatchEvent(new PointerEvent("pointerup", options));
    return down.defaultPrevented;
  };
  dialog.focus();
  expect(document.activeElement).toBe(dialog);
  expect(tap(install)).toBe(false);
  await settle();
  expect(hidden(steps)).toBe(false);
  expect(document.activeElement).toBe(close);
  back.click();
  tap(back);
  expect(hidden(steps)).toBe(false);
  expect(owner.settingsClosed).not.toHaveBeenCalled();
  expect(tap(close)).toBe(true);
  expect(hidden(steps)).toBe(true);
  expect(document.activeElement).toBe(install);
  expect(owner.settingsClosed).not.toHaveBeenCalled();
  dialog.focus();
  tap(install);
  await settle();
  expect(tap(backdrop)).toBe(true);
  expect(hidden(steps)).toBe(true);
  expect(document.activeElement).toBe(install);
  expect(owner.settingsClosed).not.toHaveBeenCalled();
});

it.each(["tap", "hold", "keyboard"] as const)(
  "returns through the primary Back action once for %s",
  async (action) => {
    const { control, key, owner } = await openCard("pause");
    const back = control(WORDS.back);
    const pointer = (type: string) =>
      back.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          button: 0,
          cancelable: true,
          isPrimary: true,
          pointerId: 51,
          pointerType: "touch",
        }),
      );
    vi.useFakeTimers();
    try {
      if (action === "keyboard") {
        back.focus();
        key("Enter");
        key("Enter", { repeat: true });
      } else {
        expect(pointer("pointerdown")).toBe(false);
        if (action === "hold") {
          await vi.advanceTimersByTimeAsync(TOUCH.actionHoldMilliseconds);
        }
        pointer("pointerup");
        back.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
      }
      expect(owner.settingsClosed).toHaveBeenCalledOnce();
      expect(owner.setTouchSetting).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  },
);
