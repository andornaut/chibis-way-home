// @vitest-environment happy-dom
import { EventEmitter } from "node:events";

import { afterEach, beforeEach, expect, it, vi } from "vitest";

const gate = vi.hoisted(() => ({
  accepts: vi.fn(() => true),
  capture: vi.fn(),
  subscribe: vi.fn(),
}));
const dom = vi.hoisted(() => ({ layer: undefined as unknown, ready: Promise.resolve() }));
vi.mock("phaser", () => ({ Scene: class {} }));
vi.mock("../pwa/index.ts", () => ({ PHONE_EVENTS: { backPressed: "back-pressed" } }));
vi.mock("./modalInput.ts", async (original) => ({
  ...(await original<typeof import("./modalInput.ts")>()),
  modalInput: () => gate,
}));
vi.mock("./modalBackdrop.ts", () => ({ showModalBackdrop: () => ({ ready: dom.ready }) }));
vi.mock("./domUi.ts", () => ({
  mountSceneView: (scene: { events: EventEmitter }, view: HTMLElement) => {
    scene.events.once("shutdown", (dom.layer as UiLayer).mount(0, view));
  },
  sceneDomUi: () => dom.layer,
}));

import { START_EXIT_TEXT, TEXT } from "../data/text.ts";
import { createUiLayer, type UiLayer } from "../ui/index.ts";
import { ExitScene } from "./ExitScene.ts";

let layer: UiLayer;
beforeEach(() => {
  vi.clearAllMocks();
  gate.accepts.mockReturnValue(true);
  gate.capture.mockImplementation(() => () => gate.accepts());
  dom.ready = Promise.resolve();
  layer = createUiLayer([], document);
  dom.layer = layer;
  document.body.append(layer.element);
});
afterEach(() => layer.dispose());

function openCard(available = true) {
  const events = new EventEmitter();
  const accepted = vi.fn(async () => true);
  const cancelled = vi.fn();
  const canLeave = vi.fn(() => available);
  const stop = vi.fn(() => events.emit("shutdown"));
  const scene = Object.assign(new ExitScene(), {
    events,
    scene: { stop },
    sys: { isActive: () => true },
  });
  // Copy is supplied by the caller, independent of the native Back continuation.
  scene.init({ accepted, canLeave, cancelled, words: START_EXIT_TEXT });
  scene.create();
  const button = (label: string) =>
    [...document.querySelectorAll("button")].find((button) => button.textContent === label)!;
  return { accepted, button, canLeave, cancelled, events, scene, stop };
}

it.each([
  { accepted: false, label: TEXT.restart.cancel },
  { accepted: true, label: TEXT.start.exit },
])("dispatches only one decision from $label after releasing its modal", async (decision) => {
  const card = openCard();
  await dom.ready;
  expect(document.activeElement?.getAttribute("role")).toBe("dialog");
  expect(document.activeElement?.textContent).toContain(START_EXIT_TEXT.question);
  gate.accepts.mockReturnValue(false);
  card.button(decision.label).click();
  await Promise.resolve();
  expect(card.stop).not.toHaveBeenCalled();
  gate.accepts.mockReturnValue(true);
  card.button(decision.label).click();
  window.dispatchEvent(new Event("back-pressed"));
  await Promise.resolve();
  expect(card.stop).toHaveBeenCalledOnce();
  expect(card.accepted).toHaveBeenCalledTimes(decision.accepted ? 1 : 0);
  expect(card.cancelled).toHaveBeenCalledTimes(decision.accepted ? 0 : 1);
  expect(document.querySelector("[role=dialog]")).toBeNull();
});

it("keeps one pending native continuation and restores Cancel after a refused departure", async () => {
  const card = openCard();
  await dom.ready;
  let resolve!: (left: boolean) => void;
  card.accepted.mockImplementationOnce(
    () =>
      new Promise<boolean>((done) => {
        resolve = done;
      }),
  );
  card.button(TEXT.start.exit).click();
  card.button(TEXT.start.exit).click();
  window.dispatchEvent(new Event("back-pressed"));
  expect(card.accepted).toHaveBeenCalledOnce();
  expect(card.cancelled).not.toHaveBeenCalled();
  expect(card.stop).not.toHaveBeenCalled();
  card.canLeave.mockReturnValue(false);
  resolve(false);
  await Promise.resolve();
  expect(card.button(TEXT.restart.cancel).disabled).toBe(false);
  expect(card.button(TEXT.start.exit).disabled).toBe(true);
  card.button(TEXT.restart.cancel).click();
  expect(card.cancelled).toHaveBeenCalledOnce();
  expect(card.stop).toHaveBeenCalledOnce();
});

it("shows an unavailable Exit as disabled while keeping Cancel usable", async () => {
  const card = openCard(false);
  await dom.ready;
  expect(card.button(TEXT.start.exit).disabled).toBe(true);
  expect(card.button(TEXT.start.exit).textContent).toBe(TEXT.start.exit);
  expect(card.button(TEXT.restart.cancel).disabled).toBe(false);
  card.button(TEXT.start.exit).click();
  expect(card.accepted).not.toHaveBeenCalled();
  card.canLeave.mockReturnValue(true);
  card.scene.update();
  expect(card.button(TEXT.start.exit).disabled).toBe(false);
  card.canLeave.mockReturnValue(false);
  card.scene.update();
  expect(card.button(TEXT.start.exit).disabled).toBe(true);
  card.button(TEXT.restart.cancel).click();
  expect(card.cancelled).toHaveBeenCalledOnce();
});

it("cancels platform Back at modal priority without passing it to the opener", async () => {
  const card = openCard();
  await dom.ready;
  const openerBack = vi.fn();
  window.addEventListener("back-pressed", openerBack);
  try {
    window.dispatchEvent(new Event("back-pressed"));
    expect(card.cancelled).toHaveBeenCalledOnce();
    expect(card.accepted).not.toHaveBeenCalled();
    expect(openerBack).not.toHaveBeenCalled();
    window.dispatchEvent(new Event("back-pressed"));
    expect(openerBack).toHaveBeenCalledOnce();
  } finally {
    window.removeEventListener("back-pressed", openerBack);
  }
});

it("does not reopen or dispatch a decision after shutdown while the backdrop is pending", async () => {
  let ready!: () => void;
  dom.ready = new Promise<void>((resolve) => {
    ready = resolve;
  });
  const card = openCard();
  card.events.emit("shutdown");
  ready();
  await dom.ready;
  window.dispatchEvent(new Event("back-pressed"));
  expect(document.querySelector("[role=dialog]")).toBeNull();
  expect(card.accepted).not.toHaveBeenCalled();
  expect(card.cancelled).not.toHaveBeenCalled();
});

it("consumes platform Back while its pending backdrop keeps input guarded", async () => {
  let ready!: () => void;
  dom.ready = new Promise<void>((resolve) => {
    ready = resolve;
  });
  gate.accepts.mockReturnValue(false);
  const card = openCard();
  const openerBack = vi.fn();
  window.addEventListener("back-pressed", openerBack);
  try {
    window.dispatchEvent(new Event("back-pressed"));
    expect(openerBack).not.toHaveBeenCalled();
    expect(card.cancelled).not.toHaveBeenCalled();
    gate.accepts.mockReturnValue(true);
    ready();
    await dom.ready;
    window.dispatchEvent(new Event("back-pressed"));
    expect(card.cancelled).toHaveBeenCalledOnce();
    expect(openerBack).not.toHaveBeenCalled();
  } finally {
    window.removeEventListener("back-pressed", openerBack);
    card.events.emit("shutdown");
  }
});
