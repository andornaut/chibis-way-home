// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";

import { TEXT } from "../../data/text.ts";
import { fpsCounterShown, setFpsCounterShown } from "../settings/fpsCounter.ts";
import { mountFpsCounter } from "./fpsCounter.ts";
import { textRole } from "./theme.ts";

afterEach(() => {
  vi.useRealTimers();
  setFpsCounterShown(false);
  document.body.replaceChildren();
});

it("is off by default, then shows the rounded frame rate as a label on the page outside the game", () => {
  const game = document.createElement("div");
  game.id = "game";
  document.body.append(game);
  const unmount = mountFpsCounter(document, () => 59.6, TEXT.settings.fps);
  const counter = document.querySelector<HTMLElement>("output")!;
  expect([fpsCounterShown(), counter.hidden]).toEqual([false, true]);
  setFpsCounterShown(true);
  expect({
    hidden: counter.hidden,
    label: counter.getAttribute("aria-label"),
    onPage: counter.parentElement === document.body && !game.contains(counter),
    role: counter.classList.contains(textRole("label")),
    text: counter.textContent,
  }).toEqual({ hidden: false, label: TEXT.settings.fps, onPage: true, role: true, text: "60" });
  unmount();
  expect(document.querySelector("output")).toBeNull();
});

it("follows the frame rate while shown and stops when turned off", () => {
  vi.useFakeTimers();
  let fps = 30.2;
  const unmount = mountFpsCounter(document, () => fps, TEXT.settings.fps);
  const counter = document.querySelector<HTMLElement>("output")!;
  setFpsCounterShown(true);
  expect(counter.textContent).toBe("30");
  fps = 58.5;
  vi.advanceTimersByTime(1000);
  expect(counter.textContent).toBe("59");
  setFpsCounterShown(false);
  fps = 12;
  vi.advanceTimersByTime(1000);
  expect([counter.hidden, counter.textContent]).toEqual([true, "59"]);
  unmount();
});
