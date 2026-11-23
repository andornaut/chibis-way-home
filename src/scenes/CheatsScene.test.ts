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
import { allZonesUnlocked, endDevelopmentSession, invulnerabilityEnabled } from "../dev/mode.ts";
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
  return { control, dialog, key, openCheats, owner, scene };
}

it.each([false, true])("keeps cheat and tool behaviour in app mode %s", async (installed) => {
  const { control } = openCard(installed);
  expect(control(TEXT.settings.fps)).toBeUndefined();
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

it("shows Reset save disabled without persisted progress and blocks tap, hold and keyboard", async () => {
  vi.useFakeTimers();
  saves.resetSaveAvailable.mockResolvedValueOnce(false);
  const { control } = openCard();
  const reset = control(DEV_TEXT.resetSave.action);
  expect(reset.disabled).toBe(true);
  await vi.advanceTimersByTimeAsync(0);
  expect(reset.disabled).toBe(true);
  expect(reset.closest("[hidden]")).toBeNull();
  const touch = (type: string) =>
    reset.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        button: 0,
        isPrimary: true,
        pointerId: 1,
        pointerType: "touch",
      }),
    );
  touch("pointerdown");
  touch("pointerup");
  touch("pointerdown");
  await vi.advanceTimersByTimeAsync(TOUCH.actionHoldMilliseconds);
  touch("pointerup");
  reset.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }));
  reset.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  expect(document.querySelector("[role=alertdialog]")?.hasAttribute("hidden")).toBe(true);
  expect(saves.resetSave).not.toHaveBeenCalled();
});

it("keeps the invoking menu and Cheats painted and restores focus after Reset Cancel and Back", async () => {
  const { control, dialog, key, openCheats, owner } = openCard();
  await settle();
  const expectCovered = (card: HTMLElement) => {
    expect(card.closest("[hidden]")).toBeNull();
    expect(card.closest("[inert][data-ui-dimmed]")).not.toBeNull();
  };
  expectCovered(dialog);
  const reset = control(DEV_TEXT.resetSave.action);
  expect(reset.disabled).toBe(false);
  const cheats = reset.closest<HTMLElement>("[role=dialog]")!;
  const scrollBody = cheats.querySelector<HTMLElement>(".cheats-body")!;
  expect(document.activeElement).toBe(cheats);
  key("Tab");
  expect(cheats.contains(document.activeElement)).toBe(true);
  const closeCheats = cheats.querySelector<HTMLButtonElement>(".ui-card-actions button")!;
  const closeCheatsX = cheats.querySelector<HTMLButtonElement>(".ui-close-button")!;
  expect([...cheats.querySelectorAll(".ui-card-actions button")]).toEqual([closeCheats]);
  expect(closeCheats.textContent).toBe(TEXT.achievements.back);
  expect(closeCheats.classList.contains("ui-text-button-primary")).toBe(true);
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
  reset.click();
  confirm.querySelector<HTMLButtonElement>(".ui-close-button")!.click();
  expect(document.activeElement).toBe(reset);
  expect(confirm.hidden).toBe(true);
  expect(scrollBody.scrollTop).toBe(100);
  expectCovered(dialog);
  closeCheats.click();
  expect(owner.cheatsClosed).toHaveBeenCalledOnce();
  expect(dialog.closest("[hidden], [inert], [data-ui-dimmed]")).toBeNull();
  expect(document.activeElement).toBe(openCheats);
  expect(saves.resetSave).not.toHaveBeenCalled();
});

it("confirms Reset without starting a cheat session or returning to the menu", async () => {
  const { control, owner } = openCard(true);
  await settle();
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

it("prevents compatibility mouse focus only for an eligible touch on a Cheats dismissal", async () => {
  const { control } = openCard();
  await settle();
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

it("renders a pending tips write as busy and consumes held releases before restoring dismissal", async () => {
  let available!: (value: boolean) => void;
  saves.resetSaveAvailable.mockReturnValueOnce(
    new Promise((resolve) => {
      available = resolve;
    }),
  );
  saves.resetSaveAvailable.mockResolvedValueOnce(false);
  let saved!: (value: { status: string }) => void;
  saves.clearSeenTips.mockReturnValueOnce(
    new Promise((resolve) => {
      saved = resolve;
    }),
  );
  const { control, dialog, owner, scene } = openCard();
  await settle();
  vi.useFakeTimers();
  const tips = control(DEV_TEXT.showTipsAgain);
  const cheats = tips.closest<HTMLElement>("[role=dialog]")!;
  const close = cheats.querySelector<HTMLButtonElement>(".ui-close-button")!;
  const back = cheats.querySelector<HTMLButtonElement>(".ui-card-actions button")!;
  const pointer = (element: HTMLElement, type: string, pointerId: number) =>
    element.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        button: 0,
        isPrimary: true,
        pointerId,
        pointerType: "touch",
      }),
    );
  pointer(tips, "pointerdown", 21);
  await vi.advanceTimersByTimeAsync(TOUCH.actionHoldMilliseconds);
  expect(saves.clearSeenTips).toHaveBeenCalledOnce();
  expect(cheats.getAttribute("aria-busy")).toBe("true");
  expect([close.disabled, back.disabled, tips.disabled]).toEqual([true, true, true]);
  expect(cheats.querySelector("[data-pressed], [data-ui-pressed]")).toBeNull();
  expect(document.activeElement).toBe(cheats);
  available(true);
  await vi.advanceTimersByTimeAsync(0);
  expect(control(DEV_TEXT.resetSave.action).disabled).toBe(true);
  close.click();
  back.click();
  pointer(close, "pointerdown", 22);
  await vi.advanceTimersByTimeAsync(TOUCH.actionHoldMilliseconds);
  scene.back();
  cheats.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
  cheats.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }));
  expect(owner.cheatsClosed).not.toHaveBeenCalled();
  saved({ status: "saved" });
  await vi.advanceTimersByTimeAsync(0);
  expect(cheats.getAttribute("aria-busy")).toBe("false");
  expect([close.disabled, back.disabled, tips.disabled]).toEqual([false, false, false]);
  expect(control(DEV_TEXT.resetSave.action).disabled).toBe(true);
  expect(document.activeElement).toBe(tips);
  pointer(tips, "pointerup", 21);
  tips.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
  pointer(close, "pointerup", 22);
  expect(saves.clearSeenTips).toHaveBeenCalledOnce();
  expect(owner.cheatsClosed).not.toHaveBeenCalled();
  expect(saves.startCheatSession).not.toHaveBeenCalled();
  pointer(close, "pointerdown", 23);
  pointer(close, "pointerup", 23);
  expect(owner.cheatsClosed).toHaveBeenCalledOnce();
  expect(dialog.closest("[inert]")).toBeNull();
});

it("keeps Reset X and Cancel disabled until settlement, then restores the available invoker", async () => {
  let saved!: (value: { status: string }) => void;
  saves.resetSave.mockReturnValueOnce(
    new Promise((resolve) => {
      saved = resolve;
    }),
  );
  const { control, key, owner, scene } = openCard();
  await settle();
  const reset = control(DEV_TEXT.resetSave.action);
  reset.click();
  const confirm = document.querySelector<HTMLElement>("[role=alertdialog]")!;
  const close = confirm.querySelector<HTMLButtonElement>(".ui-close-button")!;
  const cancel = control(DEV_TEXT.resetSave.confirm.cancel);
  const accept = control(DEV_TEXT.resetSave.confirm.accept);
  vi.useFakeTimers();
  const pointer = (element: HTMLElement, type: string, pointerId: number) =>
    element.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        button: 0,
        isPrimary: true,
        pointerId,
        pointerType: "touch",
      }),
    );
  pointer(accept, "pointerdown", 31);
  await vi.advanceTimersByTimeAsync(TOUCH.actionHoldMilliseconds);
  expect(saves.resetSave).toHaveBeenCalledOnce();
  expect(confirm.getAttribute("aria-busy")).toBe("true");
  expect([close.disabled, cancel.disabled, accept.disabled]).toEqual([true, true, true]);
  expect(document.activeElement).toBe(confirm);
  expect(confirm.querySelector("[data-pressed], [data-ui-pressed]")).toBeNull();
  close.click();
  cancel.click();
  key("Escape");
  key(" ");
  scene.back();
  pointer(close, "pointerdown", 32);
  await vi.advanceTimersByTimeAsync(TOUCH.actionHoldMilliseconds);
  expect(confirm.hidden).toBe(false);
  expect(owner.cheatsClosed).not.toHaveBeenCalled();
  saved({ status: "unavailable" });
  await vi.advanceTimersByTimeAsync(0);
  expect(confirm.hidden).toBe(true);
  expect(confirm.getAttribute("aria-busy")).toBe("false");
  expect(reset.disabled).toBe(false);
  expect(document.activeElement).toBe(reset);
  expect(document.querySelector(".cheats-status")?.textContent).toBe(
    DEV_TEXT.grantResults.unavailable,
  );
  pointer(accept, "pointerup", 31);
  accept.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
  pointer(close, "pointerup", 32);
  expect(saves.resetSave).toHaveBeenCalledOnce();
  expect(owner.returnToStart).not.toHaveBeenCalled();
  reset.click();
  expect([close.disabled, cancel.disabled, accept.disabled]).toEqual([false, false, false]);
  pointer(close, "pointerdown", 33);
  pointer(close, "pointerup", 33);
  expect(confirm.hidden).toBe(true);
  expect(document.activeElement).toBe(reset);
  expect(owner.cheatsClosed).not.toHaveBeenCalled();
});
