// @vitest-environment happy-dom
import { EventEmitter } from "node:events";

import type { Scene } from "phaser";
import { afterEach, expect, it, vi } from "vitest";

import { TOUCH } from "../data/touch.ts";
import { bindGameActions } from "../ui/index.ts";
import {
  globalMenuInput,
  modalInput,
  trackActionBinding,
  trackMenuActionBinding,
} from "./modalInput.ts";

const stops: (() => void)[] = [];
const scene = (game: object = {}) => ({ events: new EventEmitter(), game }) as unknown as Scene;
const pointer = (target: HTMLElement, type: string, pointerId = 1) =>
  target.dispatchEvent(
    new PointerEvent(type, { bubbles: true, button: 0, isPrimary: true, pointerId }),
  );
const click = (target: HTMLElement) =>
  target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 }));
const button = () => {
  const element = document.createElement("button");
  document.body.append(element);
  return element;
};

afterEach(() => {
  stops.splice(0).forEach((stop) => stop());
  document.body.replaceChildren();
  vi.useRealTimers();
});

it("cancels an installed binding synchronously when actual scene readiness changes", () => {
  vi.useFakeTimers();
  const input = modalInput(scene());
  const element = button();
  const activate = vi.fn();
  const binding = trackActionBinding(
    input,
    bindGameActions(
      {
        guard: { gate: input },
        resolve: () => ({ activate, available: () => true, element }),
      },
      element,
    ),
  );
  stops.push(binding);
  pointer(element, "pointerdown");
  input.ready(false);
  expect(vi.getTimerCount()).toBe(0);
  input.ready(true);
  vi.advanceTimersByTime(TOUCH.actionHoldMilliseconds);
  pointer(element, "pointerup");
  click(element);
  expect(activate).not.toHaveBeenCalled();
  pointer(element, "pointerdown", 2);
  pointer(element, "pointerup", 2);
  expect(activate).toHaveBeenCalledOnce();
});

it("keeps release suppression when the held action opens a modal and cancels reentrantly", () => {
  vi.useFakeTimers();
  const input = modalInput(scene());
  const element = button();
  const activate = vi.fn(() => input.open());
  stops.push(
    trackActionBinding(
      input,
      bindGameActions(
        {
          guard: { gate: input },
          resolve: () => ({ activate, available: () => true, element }),
        },
        element,
      ),
    ),
  );
  pointer(element, "pointerdown");
  vi.advanceTimersByTime(TOUCH.actionHoldMilliseconds);
  expect(activate).toHaveBeenCalledOnce();
  pointer(element, "pointerup");
  click(element);
  expect(activate).toHaveBeenCalledOnce();
  pointer(element, "pointerdown", 2);
  pointer(element, "pointerup", 2);
  expect(activate).toHaveBeenCalledTimes(2);
});

it("cancels the persistent menu binding on another source scene's readiness transition", () => {
  vi.useFakeTimers();
  const game = {};
  const pause = scene(game);
  const source = modalInput(scene(game));
  const element = button();
  const activate = vi.fn();
  const entry = globalMenuInput(pause, () => true);
  stops.push(
    trackMenuActionBinding(
      pause,
      trackActionBinding(
        modalInput(pause),
        bindGameActions(
          {
            guard: { gate: entry },
            resolve: () => ({ activate, available: () => true, element }),
          },
          element,
        ),
      ),
    ),
  );
  pointer(element, "pointerdown");
  source.ready(false);
  expect(vi.getTimerCount()).toBe(0);
  source.ready(true);
  vi.advanceTimersByTime(TOUCH.actionHoldMilliseconds);
  pointer(element, "pointerup");
  click(element);
  expect(activate).not.toHaveBeenCalled();
});
