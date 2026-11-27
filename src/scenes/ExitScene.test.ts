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

function openCard() {
  const events = new EventEmitter();
  const accepted = vi.fn();
  const cancelled = vi.fn();
  const stop = vi.fn(() => events.emit("shutdown"));
  const scene = Object.assign(new ExitScene(), {
    events,
    scene: { stop },
    sys: { isActive: () => true },
  });
  // Copy is supplied by the caller, independent of the native Back continuation.
  scene.init({ accepted, cancelled, words: START_EXIT_TEXT });
  scene.create();
  const button = (label: string) =>
    [...document.querySelectorAll("button")].find((button) => button.textContent === label)!;
  return { accepted, button, cancelled, events, stop };
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
  expect(card.stop).not.toHaveBeenCalled();
  gate.accepts.mockReturnValue(true);
  card.button(decision.label).click();
  window.dispatchEvent(new Event("back-pressed"));
  expect(card.stop).toHaveBeenCalledOnce();
  expect(card.accepted).toHaveBeenCalledTimes(decision.accepted ? 1 : 0);
  expect(card.cancelled).toHaveBeenCalledTimes(decision.accepted ? 0 : 1);
  expect(document.querySelector("[role=dialog]")).toBeNull();
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
