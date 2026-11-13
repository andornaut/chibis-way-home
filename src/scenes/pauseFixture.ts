import { EventEmitter } from "node:events";

import palette from "../../public/art/palette.json" with { type: "json" };
import dash from "../../public/art/sprites/icon-skill-dash.json" with { type: "json" };
import doubleJump from "../../public/art/sprites/icon-skill-double-jump.json" with { type: "json" };
import speedy from "../../public/art/sprites/icon-skill-speedy.json" with { type: "json" };
import pause from "../../public/art/sprites/ui-pause.json" with { type: "json" };
import type { SkillId } from "../data/types/index.ts";
import { SKILL_ART } from "../ui/index.ts";
import { PauseScene } from "./PauseScene.ts";

// Test fixtures: a PauseScene created against stand-ins for Phaser's scene parts, its HTML view in
// the page. The test file mocks ./domUi (mounting views in a UI layer it owns), ./modalBackdrop and the page
// services the scene reaches.

const SHEETS: Readonly<Record<string, unknown>> = {
  palette,
  [SKILL_ART.dash]: dash,
  [SKILL_ART.doubleJump]: doubleJump,
  [SKILL_ART.speedy]: speedy,
  "ui-pause": pause,
};

// The scene manager's calls the scene makes, keyed by scene key.
export interface ScenesStub {
  readonly key: string;
  bringToTop?(): void;
  get(key: string): unknown;
  isActive(key: string): boolean;
  isPaused(key: string): boolean;
  launch(key: string, data?: unknown): void;
  pause(key: string): void;
  resume(key: string): void;
  stop(key: string): void;
}

// What the tests reach of the scene: its view's controls, and its clock and update.
export function createPauseScene(game: { readonly events: EventEmitter }, scenes: ScenesStub) {
  const events = new EventEmitter();
  const keyboard = new EventEmitter();
  const time = { now: 0 };
  const scene = Object.assign(new PauseScene(), {
    cache: { json: { get: (key: string) => SHEETS[key] } },
    events,
    game,
    input: { keyboard },
    scene: { bringToTop: () => {}, ...scenes },
    sys: { isActive: () => true },
    time,
  });
  scene.create();
  const root = [...document.querySelectorAll<HTMLElement>(".pause-scene")].at(-1)!;
  const dialog = root.querySelector<HTMLElement>("[role=dialog]")!;
  const button = (label: string) =>
    [...dialog.querySelectorAll<HTMLButtonElement>(".ui-text-button")].find(
      ({ textContent }) => textContent === label,
    )!;
  return {
    button,
    close: dialog.querySelector<HTMLButtonElement>(".ui-close-button")!,
    dialog,
    events,
    hud: root.querySelector<HTMLElement>(".skill-hud")!,
    keyboard,
    pauseButton: root.querySelector<HTMLButtonElement>(".pause-button")!,
    root,
    scene,
    skill: (skill: SkillId) =>
      root.querySelector<HTMLButtonElement>(`.skill-button[data-skill="${skill}"]`)!,
    time,
    update: () => scene.update(),
  };
}

// Lets every pending promise settle.
export function settle(): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

// A pointer's press on target, as the browser sends it: its pointerdown, then, once lifted, its
// pointerup and, unless other fingers are down, the click that follows.
export function press(target: Element, pointerId = 1) {
  const pointer = { bubbles: true, clientX: 5, clientY: 5, pointerId };
  target.dispatchEvent(new PointerEvent("pointerdown", pointer));
  return {
    lift(at: Element = target, x = 5, click = true) {
      at.dispatchEvent(new PointerEvent("pointerup", { ...pointer, clientX: x }));
      if (click) {
        at.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
      }
    },
    move(at: Element, x: number) {
      at.dispatchEvent(new PointerEvent("pointermove", { ...pointer, clientX: x }));
    },
  };
}

export function tap(target: Element, pointerId = 1): void {
  press(target, pointerId).lift();
}

// A key pressed in the page: the modal layer and the focused control see it first, and Phaser's
// keyboards (keyboards, in scene order from the top) only if nothing stopped it on the way to the
// window. Returns the event, and whether anything stopped its propagation.
export function pressKey(
  keyboards: readonly EventEmitter[],
  key: string,
  options: KeyboardEventInit = {},
) {
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key, ...options });
  const stopped = { value: false };
  const stop = event.stopPropagation.bind(event);
  Object.defineProperty(event, "stopPropagation", {
    value: () => {
      stopped.value = true;
      stop();
    },
  });
  (document.activeElement ?? document.body).dispatchEvent(event);
  if (!stopped.value) {
    keyboards.forEach((keyboard) => keyboard.emit("keydown", event));
  }
  return { event, stopped: () => stopped.value };
}
