// @vitest-environment happy-dom
import { EventEmitter } from "node:events";

import { INSTALLED_APP_DISPLAY_QUERY } from "@andornaut/game-kit/runtime/web/pwa/backNavigation";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const gate = vi.hoisted(() => ({
  accepts: vi.fn(() => true),
  capture: vi.fn(),
  invalidate: vi.fn(),
  open: vi.fn(),
  subscribe: vi.fn(),
}));
const dom = vi.hoisted(() => ({ layer: undefined as undefined | object }));
const saves = vi.hoisted(() => ({
  clearSeenTips: vi.fn(() => Promise.resolve({ status: "saved" })),
  resetSave: vi.fn(() => Promise.resolve({ status: "saved" })),
  resetSaveAvailable: vi.fn(() => Promise.resolve(true)),
  startCheatSession: vi.fn(),
}));
vi.mock("./save.ts", () => saves);
vi.mock("phaser", () => ({ Scene: class {} }));
vi.mock("./modalInput.ts", async (original) => ({
  ...(await original<typeof import("./modalInput.ts")>()),
  modalInput: () => gate,
}));
vi.mock("./domUi.ts", () => ({
  mountSceneView: (scene: { events: EventEmitter }, view: HTMLElement) => {
    const unmount = (dom.layer as UiLayer).mount(1, view);
    scene.events.once("shutdown", unmount);
  },
  sceneDomUi: () => dom.layer,
}));

import { DEV_TEXT } from "../data/dev.ts";
import { TEXT } from "../data/text.ts";
import { TOUCH } from "../data/touch.ts";
import {
  allPowerUpsUnlocked,
  allZonesUnlocked,
  endDevelopmentSession,
  invulnerabilityEnabled,
} from "../dev/mode.ts";
import { createUiLayer, type UiLayer } from "../ui/index.ts";
import { CheatsScene } from "./CheatsScene.ts";

let layer: UiLayer;

beforeEach(() => {
  vi.clearAllMocks();
  saves.clearSeenTips.mockReset().mockResolvedValue({ status: "saved" });
  saves.resetSave.mockReset().mockResolvedValue({ status: "saved" });
  saves.resetSaveAvailable.mockReset().mockResolvedValue(true);
  gate.accepts.mockReturnValue(true);
  gate.capture.mockImplementation(() => () => gate.accepts());
  layer = createUiLayer([], document);
  document.body.append(layer.element);
  dom.layer = layer;
});

afterEach(() => {
  layer.dispose();
  endDevelopmentSession();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function openCard(installed = false) {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({ matches: installed && query === INSTALLED_APP_DISPLAY_QUERY }) as MediaQueryList,
  );
  const dialog = document.createElement("section");
  const openCheats = document.createElement("button");
  openCheats.textContent = DEV_TEXT.openCheats;
  dialog.append(openCheats);
  layer.mount(0, dialog);
  layer.modals.open({ isolation: "dialog" }, dialog);
  openCheats.focus();
  const events = new EventEmitter();
  const owner = { cheatsClosed: vi.fn() };
  const scene = Object.assign(new CheatsScene(), {
    events,
    scene: { get: () => owner, stop: () => events.emit("shutdown") },
    sys: { isActive: () => true },
  });
  scene.init({ opener: "pause" });
  scene.create();
  const control = (label: string) =>
    [...document.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) =>
        !button.closest("[hidden]") &&
        (button.getAttribute("aria-label") ??
          document.getElementById(button.getAttribute("aria-labelledby") ?? "")?.textContent ??
          button.textContent) === label,
    )!;
  const key = (value: string, options: KeyboardEventInit = {}) =>
    document.activeElement?.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: value, ...options }),
    );
  return { control, dialog, key, openCheats, owner, scene };
}

it.each([false, true])("shows only the current run-only controls in app mode %s", (installed) => {
  const { control } = openCard(installed);
  const card = control(DEV_TEXT.invulnerable).closest<HTMLElement>("[role=dialog]")!;
  expect(
    [...card.querySelectorAll("button")].map(
      (button) => button.getAttribute("aria-label") ?? button.textContent,
    ),
  ).toEqual([
    DEV_TEXT.unlockAllPowerUps,
    DEV_TEXT.unlockAllZones,
    [DEV_TEXT.invulnerable, DEV_TEXT.invulnerableNote, TEXT.settings.state.off].join(""),
    TEXT.achievements.back,
    DEV_TEXT.cheats.close,
  ]);
  const invincibility = control(DEV_TEXT.invulnerable);
  const note = document.getElementById(invincibility.getAttribute("aria-describedby")!);
  expect(note?.textContent).toBe(DEV_TEXT.invulnerableNote);
  expect(card.dataset.cardWidth).toBe("medium");
  expect(card.querySelector(".ui-card-scroll")).toBeNull();
  expect(document.querySelector("[role=alertdialog]")).toBeNull();
  expect(saves.resetSave).not.toHaveBeenCalled();
  expect(saves.clearSeenTips).not.toHaveBeenCalled();
});

it("applies each cheat only to the session and reports unlocks without touching saved progress", () => {
  const { control } = openCard();
  control(DEV_TEXT.unlockAllPowerUps).click();
  expect(allPowerUpsUnlocked()).toBe(true);
  expect(document.querySelector(".cheats-status")?.textContent).toBe(
    DEV_TEXT.results.unlockAllPowerUps,
  );
  control(DEV_TEXT.unlockAllZones).click();
  expect(allZonesUnlocked()).toBe(true);
  expect(document.querySelector(".cheats-status")?.textContent).toBe("");
  const toggle = control(DEV_TEXT.invulnerable);
  toggle.click();
  expect(invulnerabilityEnabled()).toBe(true);
  expect(toggle.getAttribute("aria-checked")).toBe("true");
  expect(toggle.querySelector(".settings-state")?.textContent).toBe(TEXT.settings.state.on);
  toggle.click();
  expect(invulnerabilityEnabled()).toBe(false);
  expect(saves.startCheatSession).toHaveBeenCalledTimes(4);
  expect(saves.resetSave).not.toHaveBeenCalled();
  expect(saves.clearSeenTips).not.toHaveBeenCalled();
});

it.each(["tap", "hold", "keyboard"] as const)(
  "returns from Cheats once by %s and restores its invoker",
  async (action) => {
    const { control, dialog, key, openCheats, owner } = openCard();
    const close = control(DEV_TEXT.cheats.close);
    vi.useFakeTimers();
    try {
      if (action === "keyboard") {
        control(TEXT.achievements.back).focus();
        key("Enter");
        key("Enter", { repeat: true });
      } else {
        const options = {
          bubbles: true,
          button: 0,
          cancelable: true,
          isPrimary: true,
          pointerId: 61,
          pointerType: "touch",
        };
        expect(close.dispatchEvent(new PointerEvent("pointerdown", options))).toBe(false);
        if (action === "hold") {
          await vi.advanceTimersByTimeAsync(TOUCH.actionHoldMilliseconds);
        }
        close.dispatchEvent(new PointerEvent("pointerup", options));
        close.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
      }
      expect(owner.cheatsClosed).toHaveBeenCalledOnce();
      expect(dialog.closest("[hidden], [inert]")).toBeNull();
      expect(document.activeElement).toBe(openCheats);
      expect(saves.startCheatSession).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  },
);

it("keeps all actions behind the modal gate and preserves the switch's decorative state stack", () => {
  const { control, scene } = openCard();
  const toggle = control(DEV_TEXT.invulnerable);
  const value = toggle.querySelector(".settings-toggle-value")!;
  expect([...value.children].map((child) => child.className)).toEqual([
    "settings-switch",
    "settings-state",
  ]);
  expect(value.getAttribute("aria-hidden")).toBe("true");
  gate.accepts.mockReturnValue(false);
  control(DEV_TEXT.unlockAllPowerUps).click();
  toggle.click();
  control(TEXT.achievements.back).click();
  scene.back();
  expect(saves.startCheatSession).not.toHaveBeenCalled();
  expect(invulnerabilityEnabled()).toBe(false);
});

it("prevents compatibility mouse focus only for an eligible touch on a Cheats dismissal", () => {
  const { control } = openCard();
  const action = control(DEV_TEXT.unlockAllPowerUps);
  const cheats = action.closest<HTMLElement>("[role=dialog]")!;
  const close = control(TEXT.achievements.back);
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
  expect(prevented(action)).toBe(false);
  gate.accepts.mockReturnValue(false);
  expect(prevented(closeX)).toBe(false);
});
