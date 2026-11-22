// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";

import { TOUCH } from "../../data/touch.ts";
import {
  assertGameActions,
  bindFactoryAction,
  bindGameActions,
  createGameButton,
} from "./actionBinding.ts";

const stops: (() => void)[] = [];
const gate = { accepts: () => true, capture: () => () => true };
const pointer = (target: HTMLElement, type: string, id = 1, x = 0) => {
  const event = new PointerEvent(type, {
    bubbles: true,
    button: 0,
    cancelable: true,
    clientX: x,
    isPrimary: true,
    pointerId: id,
  });
  target.dispatchEvent(event);
  return event;
};
const compatibilityClick = (button: HTMLElement) =>
  button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 }));

afterEach(() => {
  stops.splice(0).forEach((stop) => stop());
  document.body.replaceChildren();
  vi.useRealTimers();
});

it("uses the approved default once on hold, consumes release and retains native keyboard activation", () => {
  vi.useFakeTimers();
  const button = document.createElement("button");
  document.body.append(button);
  const activate = vi.fn();
  const action = { activate, available: () => true, element: button };
  stops.push(bindGameActions({ guard: { gate }, resolve: () => action }, button));
  pointer(button, "pointerdown");
  vi.advanceTimersByTime(TOUCH.actionHoldMilliseconds - 1);
  expect(activate).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(activate).toHaveBeenCalledOnce();
  pointer(button, "pointerup");
  compatibilityClick(button);
  expect(activate).toHaveBeenCalledOnce();
  button.click();
  expect(activate).toHaveBeenCalledTimes(2);
});

it("dispatches the standard button once through the current native and delegated pointer routes", () => {
  vi.useFakeTimers();
  const root = document.createElement("section");
  const { element: button } = createGameButton(document, {}, { kind: "text", label: "Continue" });
  root.append(button);
  document.body.append(root);
  const activate = vi.fn();
  const hold = vi.fn();
  const accepts = vi.fn(() => true);
  const identity = {};
  let physical = identity;
  const action = { activate, available: () => true, element: button, hold, identity };
  const binding = bindGameActions(
    {
      guard: { gate: { ...gate, accepts } },
      resolve: (target) => (target === button ? action : null),
      resolvePointer: () => ({ ...action, identity: physical }),
    },
    root,
  );
  stops.push(binding);
  assertGameActions(root);
  button.click();
  pointer(button, "pointerdown");
  expect(button.hasAttribute("data-ui-pressed")).toBe(true);
  pointer(button, "pointerup");
  compatibilityClick(button);
  expect(activate).toHaveBeenCalledTimes(2);
  expect(button.hasAttribute("data-ui-pressed")).toBe(false);

  pointer(button, "pointerdown", 2);
  vi.advanceTimersByTime(TOUCH.actionHoldMilliseconds);
  pointer(button, "pointerup", 2);
  compatibilityClick(button);
  expect(hold).toHaveBeenCalledOnce();
  expect(activate).toHaveBeenCalledTimes(2);

  physical = {};
  pointer(button, "pointerdown", 3);
  pointer(button, "pointerup", 3);
  accepts.mockReturnValue(false);
  button.click();
  expect(activate).toHaveBeenCalledTimes(2);
});

it("keeps coordinate actions observational and refuses a replaced logical identity", () => {
  vi.useFakeTimers();
  const root = document.createElement("section");
  const region = document.createElement("div");
  const canvas = document.createElement("canvas");
  root.append(region);
  document.body.append(root, canvas);
  const underlying = vi.fn();
  canvas.addEventListener("pointerdown", underlying);
  const activate = vi.fn();
  let identity = {};
  const action = () => ({ activate, available: () => true, element: region, identity });
  stops.push(
    bindGameActions(
      {
        guard: { gate },
        pointerTarget: document,
        resolve: () => action(),
        resolvePointer: (event) => (event.clientX < 20 ? action() : null),
      },
      root,
    ),
  );
  const event = pointer(canvas, "pointerdown");
  vi.advanceTimersByTime(TOUCH.actionHoldMilliseconds);
  expect(activate).toHaveBeenCalledOnce();
  expect(underlying).toHaveBeenCalledOnce();
  expect(event.defaultPrevented).toBe(false);
  pointer(canvas, "pointerup");
  pointer(canvas, "pointerdown", 2);
  identity = {};
  vi.advanceTimersByTime(TOUCH.actionHoldMilliseconds);
  pointer(canvas, "pointerup", 2);
  expect(activate).toHaveBeenCalledOnce();
  pointer(region, "pointerdown", 3, 30);
  vi.advanceTimersByTime(TOUCH.actionHoldMilliseconds);
  expect(activate).toHaveBeenCalledOnce();
});

it("detects an unregistered discrete control while inactive actions and native editors remain valid", () => {
  const root = document.createElement("section");
  const button = document.createElement("button");
  const text = document.createElement("input");
  const range = document.createElement("input");
  range.type = "range";
  root.append(button, text, range, document.createElement("select"));
  document.body.append(root);
  button.disabled = true;
  button.hidden = true;
  const action = { activate: vi.fn(), available: () => false, element: button };
  const stop = bindGameActions(
    { guard: { gate }, resolve: (target) => (target === button ? action : null) },
    root,
  );
  stops.push(stop);
  expect(() => assertGameActions(root)).not.toThrow();
  const unregistered = document.createElement("button");
  root.append(unregistered);
  expect(() => assertGameActions(root)).toThrow("Every discrete control must register its action");
  unregistered.remove();
  stop();
  expect(() => assertGameActions(root)).toThrow("Every discrete control must register its action");
});

it("binds original cold factory callbacks without a game UI unit or a synthetic click", () => {
  vi.useFakeTimers();
  const button = document.createElement("button");
  document.body.append(button);
  const activate = vi.fn();
  button.addEventListener("click", activate);
  stops.push(bindFactoryAction({ activate, available: () => true, element: button }));
  const touch = (type: string) =>
    button.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        button: 0,
        isPrimary: false,
        pointerId: 1,
        pointerType: "touch",
      }),
    );
  touch("pointerdown");
  vi.advanceTimersByTime(TOUCH.actionHoldMilliseconds);
  expect(activate).toHaveBeenCalledOnce();
  touch("pointerup");
  compatibilityClick(button);
  expect(activate).toHaveBeenCalledOnce();
  button.click();
  expect(activate).toHaveBeenCalledTimes(2);
  pointer(button, "pointerdown", 2);
  pointer(button, "pointermove", 2, TOUCH.tapMaxDistance + 1);
  vi.advanceTimersByTime(TOUCH.actionHoldMilliseconds);
  expect(activate).toHaveBeenCalledTimes(2);
});
