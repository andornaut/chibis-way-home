// @vitest-environment happy-dom
import { EventEmitter } from "node:events";

import { afterEach, beforeEach, expect, it, vi } from "vitest";

const offer = vi.hoisted(() => ({ accept: vi.fn(), defer: vi.fn() }));
const gate = vi.hoisted(() => ({ accepts: vi.fn(() => true), capture: vi.fn() }));
const dom = vi.hoisted(() => ({ layer: undefined as undefined | object }));
const backdrop = vi.hoisted(() => ({ ready: Promise.resolve() }));
vi.mock("phaser", () => ({ Scene: class {} }));
vi.mock("../pwa", () => ({
  PHONE_EVENTS: { backPressed: "test:back" },
  startWakeLock: vi.fn(),
  stopWakeLock: vi.fn(),
  updateOffer: offer,
}));
vi.mock("./modalInput", () => ({ modalInput: () => gate }));
vi.mock("./modalBackdrop", () => ({ showModalBackdrop: () => backdrop }));
vi.mock("./domUi", () => ({
  mountSceneView: (scene: { events: EventEmitter }, view: HTMLElement) => {
    const unmount = (dom.layer as UiLayer).mount(0, view);
    scene.events.once("shutdown", unmount);
    return unmount;
  },
  sceneDomUi: () => dom.layer,
}));

import { TEXT } from "../data/text";
import { createUiLayer, type UiLayer } from "../ui";
import { UpdateScene } from "./UpdateScene";

let layer: UiLayer;
// Each test's scenes, shut down after it so none keeps a back listener.
const opened: EventEmitter[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  gate.accepts.mockReturnValue(true);
  gate.capture.mockImplementation(() => () => gate.accepts());
  backdrop.ready = Promise.resolve();
  layer = createUiLayer([], document);
  document.body.append(layer.element);
  dom.layer = layer;
});

afterEach(() => {
  opened.splice(0).forEach((events) => events.emit("shutdown"));
  layer.dispose();
});

const settle = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

// The update card, created; shown once its dim is ready unless ready is held.
async function openCard(hold = false) {
  let release = () => {};
  if (hold) {
    backdrop.ready = new Promise<void>((resolve) => {
      release = resolve;
    });
  }
  const events = new EventEmitter();
  opened.push(events);
  const scene = Object.assign(new UpdateScene(), {
    events,
    sys: { isActive: () => true },
  });
  scene.create();
  await settle();
  const dialog = document.querySelector<HTMLElement>("[role=alertdialog]")!;
  const control = (name: string) =>
    [...dialog.querySelectorAll("button")].find(
      (element) => (element.getAttribute("aria-label") ?? element.textContent) === name,
    )!;
  const key = (value: string, options: KeyboardEventInit = {}) => {
    const event = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: value,
      ...options,
    });
    (document.activeElement ?? document.body).dispatchEvent(event);
    return event;
  };
  return { control, dialog, events, key, release };
}

const focusedName = () =>
  document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.textContent;

it("shows the offer as an alert dialog named from TEXT, focused on the card", async () => {
  const { dialog } = await openCard();
  const named = (id: string | null) => document.getElementById(id ?? "")?.textContent;
  expect({
    buttons: [...dialog.querySelectorAll("button")].map(
      (button) => button.getAttribute("aria-label") ?? button.textContent,
    ),
    focused: document.activeElement === dialog,
    modal: dialog.getAttribute("aria-modal"),
    name: named(dialog.getAttribute("aria-labelledby")),
  }).toEqual({
    buttons: [TEXT.update.cancel, TEXT.update.accept, TEXT.update.close],
    focused: true,
    modal: "true",
    name: TEXT.update.title,
  });
});

it("moves the keyboard's focus through Cancel, Update now and the X, wrapping, both ways", async () => {
  const { key } = await openCard();
  const { accept, cancel, close } = TEXT.update;
  key("Tab", { shiftKey: true });
  const back = focusedName();
  const steps = (["Tab", "ArrowRight", "ArrowDown", "Tab", "ArrowLeft", "ArrowUp"] as const).map(
    (value) => {
      key(value);
      return focusedName();
    },
  );
  expect([back, ...steps]).toEqual([close, cancel, accept, close, cancel, close, accept]);
});

it("presses only the focused control: Update now accepts, Cancel and the X defer", async () => {
  const { control, key } = await openCard();
  key("Enter");
  expect(offer.accept).not.toHaveBeenCalled();
  expect(offer.defer).not.toHaveBeenCalled();
  control(TEXT.update.accept).focus();
  key("Enter");
  key("Enter", { repeat: true });
  expect(offer.accept).toHaveBeenCalledOnce();
  control(TEXT.update.cancel).focus();
  key(" ");
  control(TEXT.update.close).focus();
  key("Enter");
  expect(offer.defer).toHaveBeenCalledTimes(2);
  expect(offer.accept).toHaveBeenCalledOnce();
});

it("defers on Escape and on back while the gate accepts, and ignores P", async () => {
  const { key } = await openCard();
  const heard = vi.fn();
  window.addEventListener("keydown", heard);
  key("p");
  key("P");
  window.removeEventListener("keydown", heard);
  expect(heard).not.toHaveBeenCalled();
  expect(offer.defer).not.toHaveBeenCalled();
  key("Escape");
  expect(offer.defer).toHaveBeenCalledOnce();
  gate.accepts.mockReturnValue(false);
  window.dispatchEvent(new Event("test:back"));
  key("Escape");
  expect(offer.defer).toHaveBeenCalledOnce();
  gate.accepts.mockReturnValue(true);
  window.dispatchEvent(new Event("test:back"));
  expect(offer.defer).toHaveBeenCalledTimes(2);
});

it("defers on a tap outside the card, never on one that lands on it or travels", async () => {
  const { dialog } = await openCard();
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
  expect(offer.defer).not.toHaveBeenCalled();
  tap(outside, 0);
  expect(offer.defer).toHaveBeenCalledOnce();
});

it.each([TEXT.update.accept, TEXT.update.cancel, TEXT.update.close])(
  "guards %s until the dim under the card is ready",
  async (name) => {
    const { control, dialog, release } = await openCard(true);
    expect(dialog.closest("[hidden]")).not.toBeNull();
    control(name).click();
    expect(offer.accept).not.toHaveBeenCalled();
    expect(offer.defer).not.toHaveBeenCalled();
    release();
    await settle();
    expect(dialog.closest("[hidden]")).toBeNull();
    control(name).click();
    expect(offer.accept).toHaveBeenCalledTimes(name === TEXT.update.accept ? 1 : 0);
    expect(offer.defer).toHaveBeenCalledTimes(name === TEXT.update.accept ? 0 : 1);
  },
);

it("removes the card and gives back the keys and back when the scene shuts down", async () => {
  const { events } = await openCard();
  events.emit("shutdown");
  expect(document.querySelector("[role=alertdialog]")).toBeNull();
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Tab" });
  document.body.dispatchEvent(event);
  window.dispatchEvent(new Event("test:back"));
  expect(event.defaultPrevented).toBe(false);
  expect(offer.defer).not.toHaveBeenCalled();
});
