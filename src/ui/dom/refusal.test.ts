// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { CONTROL_REFUSAL } from "../../data/feedback";
import { refuseControl, refusing } from "./refusal";

const { flashMs, flashes, shake, shakeMs } = CONTROL_REFUSAL;
let control: HTMLButtonElement;

beforeEach(() => {
  vi.useFakeTimers();
  control = document.createElement("button");
});

afterEach(() => {
  vi.useRealTimers();
});

const state = () => ({
  red: control.hasAttribute("data-ui-refusal-red"),
  shake: control.getAttribute("data-ui-refusal-shake"),
});

it("glides out and back each shakeMs while flashing red each other flashMs, for the tuned flashes", () => {
  refuseControl(false, control);
  const strokes = [state()];
  vi.advanceTimersByTime(shakeMs);
  strokes.push(state());
  expect({
    distance: control.style.getPropertyValue("--ui-refusal-shake"),
    duration: control.style.getPropertyValue("--ui-refusal-shake-ms"),
    strokes,
  }).toEqual({
    distance: String(shake),
    duration: String(shakeMs),
    strokes: [
      { red: true, shake: "out" },
      { red: true, shake: "back" },
    ],
  });
  vi.advanceTimersByTime(flashMs - shakeMs);
  expect(state().red).toBe(false);
  vi.advanceTimersByTime(flashMs * (flashes - 1) - 1);
  expect(refusing(control)).toBe(true);
  vi.advanceTimersByTime(1);
  expect(state()).toEqual({ red: false, shake: null });
});

it("does not restart a cue that is still playing", () => {
  refuseControl(false, control);
  vi.advanceTimersByTime(flashMs);
  refuseControl(false, control);
  vi.advanceTimersByTime(flashMs * (flashes - 1));
  expect(refusing(control)).toBe(false);
});

it("holds steady red without moving under reduced motion, and stops at once", () => {
  const stop = refuseControl(true, control);
  vi.advanceTimersByTime(flashMs * (flashes - 1));
  expect(state()).toEqual({ red: true, shake: null });
  stop();
  expect(refusing(control)).toBe(false);
});
