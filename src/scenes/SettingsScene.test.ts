// @vitest-environment happy-dom
import { EventEmitter } from "node:events";

import { INSTALLED_APP_DISPLAY_QUERY } from "@andornaut/game-kit/runtime/web/pwa/backNavigation";
import type { InstallState } from "@andornaut/game-kit/runtime/web/pwa/installState";
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
const saves = vi.hoisted(() => ({
  clearSeenTips: vi.fn(() => Promise.resolve({ status: "saved" })),
  resetSave: vi.fn(() => Promise.resolve({ status: "saved" })),
  startCheatSession: vi.fn(),
}));
vi.mock("./save.ts", () => saves);
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
import { allZonesUnlocked, endDevelopmentSession, invulnerabilityEnabled } from "../dev/mode.ts";
import {
  createUiLayer,
  reducedMotion,
  setTouchSettingShown,
  touchSettingShown,
  type UiLayer,
} from "../ui/index.ts";
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
  endDevelopmentSession();
  vi.restoreAllMocks();
});

// Makes the page an installed app's window, or a browser tab again.
const appWindow = (app: boolean) =>
  vi
    .spyOn(window, "matchMedia")
    .mockImplementation(
      (query: string) =>
        ({ matches: app && query === INSTALLED_APP_DISPLAY_QUERY }) as MediaQueryList,
    );

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
    loadStage: vi.fn(),
    returnToStart: vi.fn(),
    setTouchSetting: vi.fn(setTouchSettingShown),
    settingsClosed: vi.fn(),
  };
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

// Each setting's name and effect stay separate, with decorative inline touch icons where needed.
it("describes every switch's effect separately from its setting name", async () => {
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
      name: [WORDS.moveControls, WORDS.descriptions.moveControls],
      note: WORDS.descriptions.moveControls,
    },
    {
      decorative: true,
      icons: ["use", "jump"],
      name: [WORDS.actionButtons, WORDS.descriptions.actionButtons],
      note: WORDS.descriptions.actionButtons,
    },
    {
      decorative: true,
      icons: [],
      name: [WORDS.reducedMotion, WORDS.descriptions.reducedMotion],
      note: WORDS.descriptions.reducedMotion,
    },
  ]);
});

it("shows current state text before and after toggling without changing the setting name", async () => {
  const { control } = await openCard();
  for (const [label, enabled, disabled] of [
    [WORDS.moveControls, WORDS.state.shown, WORDS.state.hidden],
    [WORDS.actionButtons, WORDS.state.shown, WORDS.state.hidden],
    [WORDS.reducedMotion, WORDS.state.on, WORDS.state.off],
  ] as const) {
    const button = control(label);
    const checked = button.getAttribute("aria-checked") === "true";
    const state = button.querySelector<HTMLElement>(".settings-state")!;
    expect(state.textContent).toBe(checked ? enabled : disabled);
    button.click();
    expect(button.getAttribute("aria-checked")).toBe(String(!checked));
    expect(state.textContent).toBe(checked ? disabled : enabled);
    expect(document.getElementById(button.getAttribute("aria-labelledby")!)?.textContent).toBe(
      label,
    );
  }
});

it("moves the keyboard's focus through the rows, Install, Open Cheats, then the close X, wrapping", async () => {
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
      "ArrowUp",
    ]),
  ).toEqual([
    ...SWITCHES,
    WORDS.install,
    DEV_TEXT.openCheats,
    WORDS.close,
    WORDS.moveControls,
    WORDS.close,
  ]);
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

it("shows Open Cheats only in a browser tab, and refuses every cheat once the page is an app window", async () => {
  appWindow(true);
  const app = await openCard("pause");
  expect(app.dialog.textContent).not.toContain(DEV_TEXT.openCheats);
  app.events.emit("shutdown");
  appWindow(false);
  const { control } = await openCard("pause");
  control(DEV_TEXT.openCheats).click();
  expect(control(DEV_TEXT.invulnerable)).toBeDefined();
  appWindow(true);
  control(DEV_TEXT.invulnerable).click();
  expect([saves.startCheatSession.mock.calls.length, invulnerabilityEnabled()]).toEqual([0, false]);
});

it("starts the cheat session for a cheat and never for a tool", async () => {
  const { control } = await openCard("pause");
  control(DEV_TEXT.openCheats).click();
  control(DEV_TEXT.fps).click();
  control(DEV_TEXT.showTipsAgain).click();
  await settle();
  expect(saves.startCheatSession).not.toHaveBeenCalled();
  expect(document.querySelector(".cheats-status")?.textContent).toBe(
    DEV_TEXT.results.showTipsAgain,
  );
  control(DEV_TEXT.invulnerable).click();
  expect([saves.startCheatSession.mock.calls.length, invulnerabilityEnabled()]).toEqual([1, true]);
  control(DEV_TEXT.unlockAllZones).click();
  expect([saves.startCheatSession.mock.calls.length, allZonesUnlocked()]).toEqual([2, true]);
  expect(document.querySelector(".cheats-status")?.textContent).toBe(
    DEV_TEXT.results.unlockAllZones,
  );
});

it("keeps Settings and Cheats visible under nested cards and restores focus on Cancel and Back", async () => {
  const { control, dialog, key, owner } = await openCard("pause");
  const openCheats = control(DEV_TEXT.openCheats);
  const motion = control(WORDS.reducedMotion);
  const motionState = motion.getAttribute("aria-checked");
  const expectCovered = (card: HTMLElement) => {
    expect(card.closest("[hidden]")).toBeNull();
    expect(card.closest("[inert][data-ui-dimmed]")).not.toBeNull();
  };
  openCheats.focus();
  openCheats.click();
  expectCovered(dialog);
  const reset = control(DEV_TEXT.resetSave.action);
  const cheats = reset.closest<HTMLElement>("[role=dialog]")!;
  const scrollBody = cheats.querySelector<HTMLElement>(".cheats-body")!;
  expect(document.activeElement).toBe(cheats);
  key("Tab");
  expect(cheats.contains(document.activeElement)).toBe(true);
  motion.click();
  expect(motion.getAttribute("aria-checked")).toBe(motionState);
  const closeCheats = cheats.querySelector<HTMLButtonElement>(".ui-card-actions button")!;
  const closeCheatsX = cheats.querySelector<HTMLButtonElement>(".ui-close-button")!;
  expect([...cheats.querySelectorAll(".ui-card-actions button")]).toEqual([closeCheats]);
  expect(closeCheatsX.getAttribute("aria-label")).toBe(DEV_TEXT.cheats.close);
  closeCheats.focus();
  expect(document.activeElement).toBe(closeCheats);
  scrollBody.scrollTop = 100;
  reset.click();
  const confirm = document.querySelector<HTMLElement>("[role=alertdialog]")!;
  const cancel = control(DEV_TEXT.resetSave.confirm.cancel);
  expectCovered(dialog);
  expectCovered(cheats);
  expect(confirm.closest("[inert], [data-ui-dimmed]")).toBeNull();
  expect(document.activeElement).toBe(cancel);
  for (const shiftKey of [false, false, true, true]) {
    key("Tab", { shiftKey });
    expect(confirm.contains(document.activeElement)).toBe(true);
  }
  control(DEV_TEXT.showTipsAgain).click();
  expect(saves.clearSeenTips).not.toHaveBeenCalled();
  expect([confirm.hidden, saves.resetSave.mock.calls.length]).toEqual([false, 0]);
  cancel.click();
  expect([confirm.hidden, saves.resetSave.mock.calls.length]).toEqual([true, 0]);
  expect(cheats.closest("[hidden], [inert], [data-ui-dimmed]")).toBeNull();
  expect(document.activeElement).toBe(reset);
  expect(scrollBody.scrollTop).toBe(100);
  expectCovered(dialog);
  closeCheatsX.click();
  expect(cheats.hidden).toBe(true);
  expect(document.activeElement).toBe(openCheats);
  openCheats.click();
  expect(scrollBody.scrollTop).toBe(0);
  expect(layer.modals.back()).toBe(true);
  expect(cheats.hidden).toBe(true);
  expect(dialog.closest("[hidden], [inert], [data-ui-dimmed]")).toBeNull();
  expect(document.activeElement).toBe(openCheats);
  expect(saves.resetSave).not.toHaveBeenCalled();
  openCheats.click();
  reset.click();
  control(DEV_TEXT.resetSave.confirm.accept).click();
  await settle();
  expect({
    closed: owner.settingsClosed.mock.calls.length,
    reset: saves.resetSave.mock.calls.length,
    returned: owner.returnToStart.mock.calls.length,
    session: saves.startCheatSession.mock.calls.length,
  }).toEqual({ closed: 0, reset: 1, returned: 1, session: 0 });
});

it("prevents compatibility mouse focus only for an eligible touch on a Cheats dismissal", async () => {
  const { control } = await openCard("pause");
  control(DEV_TEXT.openCheats).click();
  const reset = control(DEV_TEXT.resetSave.action);
  const cheats = reset.closest<HTMLElement>("[role=dialog]")!;
  const close = cheats.querySelector<HTMLButtonElement>(".ui-card-actions button")!;
  const closeX = cheats.querySelector<HTMLButtonElement>(".ui-close-button")!;
  const prevented = (element: HTMLElement, overrides: PointerEventInit = {}) => {
    const options = {
      bubbles: true,
      button: 0,
      cancelable: true,
      isPrimary: true,
      pointerId: 1,
      pointerType: "touch",
      ...overrides,
    };
    const accepted = element.dispatchEvent(new PointerEvent("pointerdown", options));
    element.dispatchEvent(new PointerEvent("pointercancel", options));
    return !accepted;
  };
  expect(prevented(close)).toBe(true);
  expect(prevented(closeX)).toBe(true);
  expect(prevented(closeX, { pointerType: "mouse" })).toBe(false);
  expect(prevented(closeX, { isPrimary: false })).toBe(false);
  expect(prevented(reset)).toBe(false);
  gate.accepts.mockReturnValue(false);
  expect(prevented(closeX)).toBe(false);
});
