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
import { allZonesUnlocked, endDevelopmentSession, invulnerabilityEnabled } from "../dev/mode.ts";
import { createUiLayer, type UiLayer } from "../ui/index.ts";
import { CheatsScene } from "./CheatsScene.ts";

let layer: UiLayer;

beforeEach(() => {
  vi.clearAllMocks();
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
});

const settle = () =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
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
  const owner = { cheatsClosed: vi.fn(), loadStage: vi.fn(), returnToStart: vi.fn() };
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
  return { control, dialog, key, openCheats, owner };
}

it.each([false, true])("keeps cheat and tool behaviour in app mode %s", async (installed) => {
  const { control } = openCard(installed);
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

it("keeps the invoking menu and Cheats painted and restores focus after Reset Cancel and Close", async () => {
  const { control, dialog, key, openCheats, owner } = openCard();
  const expectCovered = (card: HTMLElement) => {
    expect(card.closest("[hidden]")).toBeNull();
    expect(card.closest("[inert][data-ui-dimmed]")).not.toBeNull();
  };
  expectCovered(dialog);
  const reset = control(DEV_TEXT.resetSave.action);
  const cheats = reset.closest<HTMLElement>("[role=dialog]")!;
  const scrollBody = cheats.querySelector<HTMLElement>(".cheats-body")!;
  expect(document.activeElement).toBe(cheats);
  key("Tab");
  expect(cheats.contains(document.activeElement)).toBe(true);
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
  expect(owner.cheatsClosed).toHaveBeenCalledOnce();
  expect(dialog.closest("[hidden], [inert], [data-ui-dimmed]")).toBeNull();
  expect(document.activeElement).toBe(openCheats);
  expect(saves.resetSave).not.toHaveBeenCalled();
});

it("confirms Reset without starting a cheat session or returning to the menu", async () => {
  const { control, owner } = openCard(true);
  control(DEV_TEXT.resetSave.action).click();
  control(DEV_TEXT.resetSave.confirm.accept).click();
  await settle();
  expect({
    closed: owner.cheatsClosed.mock.calls.length,
    reset: saves.resetSave.mock.calls.length,
    returned: owner.returnToStart.mock.calls.length,
    session: saves.startCheatSession.mock.calls.length,
  }).toEqual({ closed: 0, reset: 1, returned: 1, session: 0 });
});

it("prevents compatibility mouse focus only for an eligible touch on a Cheats dismissal", () => {
  const { control } = openCard();
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
