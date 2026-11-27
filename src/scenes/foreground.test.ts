// @vitest-environment happy-dom
import { EventEmitter } from "node:events";

import type { Scene } from "phaser";
import { afterEach, expect, it, vi } from "vitest";

import { TEXT } from "../data/text.ts";
import { bindGameActions } from "../ui/binding/actionBinding.ts";
import { gameplayKeyHandlers } from "../ui/input/keyboardActions.ts";
import { mapKeyAction } from "../ui/input/mapInput.ts";
import {
  mapDirectionalKey,
  registerGameplayForeground,
  registerSceneForeground,
} from "./foreground.ts";
import { modalInput } from "./modalInput.ts";

const stops: (() => void)[] = [];
const gate = { accepts: () => true, capture: () => () => true };
function key(target: HTMLElement, name: string, code: string, phase = "keydown") {
  const event = new KeyboardEvent(phase, { bubbles: true, cancelable: true, code, key: name });
  target.dispatchEvent(event);
  return event;
}
function press(target: HTMLElement, name: string, code: string) {
  const event = key(target, name, code);
  key(target, name, code, "keyup");
  return event;
}
function sceneFixture(name: string) {
  const host = document.createElement("div");
  host.id = "game";
  const canvas = document.createElement("canvas");
  const root = document.createElement("section");
  host.append(canvas, root);
  document.body.append(host);
  const game = { canvas, events: new EventEmitter() };
  const source = { events: new EventEmitter(), game };
  const events = new EventEmitter();
  const scene = {
    events,
    game,
    input: { enabled: true },
    scene: { get: () => source, isActive: () => true },
    sys: { settings: { key: name } },
  } as unknown as Scene;
  stops.push(() => {
    events.emit("shutdown");
    source.events.emit("shutdown");
  });
  return { canvas, events, root, scene, source };
}
afterEach(() => {
  stops
    .splice(0)
    .reverse()
    .forEach((stop) => stop());
  document.body.replaceChildren();
});

it("uses Map aliases for focused UI, preserves each horizontal event once, and defaults safely", () => {
  const { events, root, scene } = sceneFixture("map");
  const primary = document.createElement("button"),
    home = document.createElement("button");
  primary.textContent = TEXT.map.continue;
  home.textContent = TEXT.pause.home;
  root.append(home, primary);
  const activate = vi.fn();
  stops.push(
    bindGameActions(
      {
        guard: { gate },
        resolve: (target) =>
          target === primary ? { activate, available: () => true, element: primary } : null,
        targets: () => [primary, home],
      },
      root,
    ),
  );
  stops.push(registerSceneForeground(scene, root));
  events.emit("postupdate");
  expect(document.activeElement).toBe(primary);
  primary.blur();
  events.emit("postupdate");
  expect(document.activeElement).toBe(primary);
  press(primary, "Enter", "Enter");
  expect(activate).toHaveBeenCalledOnce();
  activate.mockClear();
  home.focus();
  events.emit("postupdate");
  expect(document.activeElement).toBe(home);
  press(home, "w", "KeyW");
  expect(document.activeElement).toBe(primary);
  expect(activate).not.toHaveBeenCalled();
  press(primary, "e", "KeyE");
  expect(activate).toHaveBeenCalledOnce();
  const moves: number[] = [];
  const local = (event: KeyboardEvent) => {
    if (mapDirectionalKey(event)) {
      event.preventDefault();
      event.stopPropagation();
      moves.push(mapKeyAction(event)!.by);
    }
  };
  root.addEventListener("keydown", local);
  window.addEventListener("keydown", local);
  stops.push(() => window.removeEventListener("keydown", local));
  press(primary, "l", "KeyL");
  press(primary, "h", "KeyH");
  expect(moves).toEqual([1, -1]);
  const slider = document.createElement("div");
  slider.setAttribute("role", "slider");
  slider.tabIndex = 0;
  root.append(slider);
  slider.focus();
  expect(press(slider, "ArrowRight", "ArrowRight").defaultPrevented).toBe(false);
  const composing = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    code: "KeyA",
    key: "a",
  });
  Object.defineProperty(composing, "keyCode", { value: 229 });
  primary.dispatchEvent(composing);
  expect(composing.defaultPrevented).toBe(false);
  slider.setAttribute("role", "textbox");
  expect(press(slider, "a", "KeyA").defaultPrevented).toBe(false);
  expect(moves).toEqual([1, -1]);
  expect(activate).toHaveBeenCalledOnce();
});

it("keeps bare gameplay holds separate from focused and restored HUD actions", () => {
  const { canvas, root, scene, source } = sceneFixture("pause");
  const button = document.createElement("button");
  root.append(button);
  const activate = vi.fn();
  const held = new Set<string>();
  const keys = gameplayKeyHandlers(() => true, canvas, held);
  window.addEventListener("keydown", keys.down);
  window.addEventListener("keyup", keys.up);
  stops.push(() => {
    keys.dispose();
    window.removeEventListener("keydown", keys.down);
    window.removeEventListener("keyup", keys.up);
  });
  stops.push(
    bindGameActions(
      {
        guard: { gate },
        resolve: (target) =>
          target === button ? { activate, available: () => true, element: button } : null,
      },
      root,
    ),
  );
  stops.push(registerGameplayForeground(scene, root));
  key(canvas, "w", "KeyW");
  expect(held.has("KeyW")).toBe(true);
  button.focus();
  expect(held.size).toBe(0);
  press(button, "e", "KeyE");
  expect(activate).toHaveBeenCalledOnce();
  expect(held.size).toBe(0);
  key(canvas, "w", "KeyW", "keyup");
  button.blur();
  key(canvas, " ", "Space");
  expect(held.has("Space")).toBe(true);
  key(canvas, " ", "Space", "keyup");
  button.focus();
  modalInput(source as unknown as Scene).ready(false);
  press(button, "e", "KeyE");
  expect(activate).toHaveBeenCalledOnce();
  expect(held.size).toBe(0);
  modalInput(source as unknown as Scene).ready(true);
  button.focus();
  press(button, "e", "KeyE");
  expect(activate).toHaveBeenCalledTimes(2);
  expect(held.size).toBe(0);
});
