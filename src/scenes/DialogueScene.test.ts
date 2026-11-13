// @vitest-environment happy-dom
import { EventEmitter } from "node:events";

import { afterEach, beforeEach, expect, it, vi } from "vitest";

const dom = vi.hoisted(() => ({ layer: undefined as unknown }));
vi.mock("phaser", () => ({ Scene: class {} }));
vi.mock("./modalBackdrop.ts", () => ({ showModalBackdrop: () => ({ ready: Promise.resolve() }) }));
vi.mock("./domUi.ts", () => ({
  artFrameUrl: (_scene: unknown, art: string) => Promise.resolve(`blob:${art}`),
  conversationControls: () => [],
  mountSceneView: (scene: { events: EventEmitter }, view: HTMLElement) => {
    const unmount = (dom.layer as UiLayer).mount(0, view);
    scene.events.once("shutdown", unmount);
    return unmount;
  },
  sceneDomUi: () => dom.layer,
}));

import { DIALOGUES, SPEAKERS } from "../data/dialogues.ts";
import { TEXT } from "../data/text.ts";
import { TOUCH } from "../data/touch.ts";
import type { DialogueChoice } from "../data/types/index.ts";
import { createUiLayer, dialogueParagraphs, type UiLayer } from "../ui/index.ts";
import { DialogueChoiceScene } from "./DialogueChoiceScene.ts";
import { DialogueScene } from "./DialogueScene.ts";
import { modalInput } from "./modalInput.ts";
import { pressKey, settle } from "./pauseFixture.ts";

// A conversation of at least three paragraphs, so each test can step through it.
const [SCENE] = Object.entries(DIALOGUES).find(([, plan]) => plan.lines.length >= 3)!;
const PARAGRAPHS = dialogueParagraphs(SPEAKERS, TEXT, DIALOGUES[SCENE!]!);
let layer: UiLayer;

beforeEach(() => {
  layer = createUiLayer([], document);
  document.body.append(layer.element);
  dom.layer = layer;
});

afterEach(() => {
  layer.dispose();
});

function conversation() {
  const game = { events: new EventEmitter() };
  const opener = { dialogueClosed: vi.fn() };
  const events = new EventEmitter();
  const route = { get: () => opener, launch: vi.fn(), pause: vi.fn(), stop: vi.fn() };
  const scene = Object.assign(new DialogueScene(), {
    events,
    game,
    scene: route,
    textures: { exists: () => true },
  });
  scene.init({ scene: SCENE! });
  scene.create();
  modalInput(scene).open();
  const root = document.querySelector<HTMLElement>(".dialogue-scene")!;
  const line = () => root.querySelector(".dialogue-line")!.textContent;
  const button = (control: string) =>
    root.querySelector<HTMLButtonElement>(`[data-control=${control}]`)!;
  const press = (target: Element, travel = 0, pointerId = 1) => {
    const at = { bubbles: true, clientX: 5, clientY: 5, pointerId };
    target.dispatchEvent(new PointerEvent("pointerdown", at));
    target.dispatchEvent(new PointerEvent("pointermove", { ...at, clientX: 5 + travel }));
    target.dispatchEvent(new PointerEvent("pointerup", { ...at, clientX: 5 + travel }));
  };
  return { button, events, line, opener, press, root, route, scene };
}

it("shows the first paragraph in a labelled conversation, the focus on neither button", () => {
  const { button, line, root } = conversation();
  const dialog = root.querySelector<HTMLElement>("[role=dialog]")!;
  expect({
    focused: document.activeElement === dialog,
    label: dialog.getAttribute("aria-label"),
    line: line(),
    modal: dialog.getAttribute("aria-modal"),
    name: root.querySelector("h2")?.textContent,
    order: [...root.querySelectorAll(".dialogue-footer button")].map(
      ({ textContent }) => textContent,
    ),
  }).toEqual({
    focused: true,
    label: TEXT.dialogue.label,
    line: PARAGRAPHS[0]!.text,
    modal: "true",
    name: PARAGRAPHS[0]!.name,
    order: [TEXT.dialogue.continue, TEXT.dialogue.skip],
  });
  expect(button("continue").textContent).toBe(TEXT.dialogue.continue);
});

it("advances on a fresh tap anywhere but Skip, and never on a drag or a second finger", () => {
  const { button, line, press, root } = conversation();
  const backdrop = root.querySelector(".ui-backdrop")!;
  press(backdrop, TOUCH.tapMaxDistance + 1);
  const second = { bubbles: true, clientX: 5, clientY: 5, pointerId: 2 };
  backdrop.dispatchEvent(new PointerEvent("pointerdown", { ...second, pointerId: 1 }));
  backdrop.dispatchEvent(new PointerEvent("pointerdown", second));
  backdrop.dispatchEvent(new PointerEvent("pointerup", second));
  expect(line()).toBe(PARAGRAPHS[0]!.text);
  backdrop.dispatchEvent(new PointerEvent("pointerup", { ...second, pointerId: 1 }));
  expect(line()).toBe(PARAGRAPHS[1]!.text);
  press(button("continue"));
  expect(line()).toBe(PARAGRAPHS[2]!.text);
});

it("skips the rest on a Skip tap, closing once through its opener", () => {
  const { button, opener, press, route } = conversation();
  press(button("skip"));
  press(button("skip"));
  expect(route.stop).toHaveBeenCalledOnce();
  expect(opener.dialogueClosed).toHaveBeenCalledExactlyOnceWith(undefined);
});

it("steps the focus through Continue then Skip, wrapping, and presses the focused one", () => {
  const { line, opener } = conversation();
  const steps = (["Tab", "Tab", "ArrowRight", "ArrowUp"] as const).map((key) => {
    expect(pressKey([], key).stopped()).toBe(true);
    return document.activeElement?.textContent;
  });
  const { continue: next, skip } = TEXT.dialogue;
  expect(steps).toEqual([next, skip, next, skip]);
  pressKey([], "x");
  expect(line()).toBe(PARAGRAPHS[1]!.text);
  pressKey([], "Enter", { repeat: true });
  expect(line()).toBe(PARAGRAPHS[1]!.text);
  pressKey([], "Enter");
  expect(opener.dialogueClosed).toHaveBeenCalledOnce();
});

it("focuses a touched dialogue control without a ring and keeps keyboard focus visible", () => {
  const { button, press } = conversation();
  const next = button("continue");
  const skip = button("skip");
  const touchFocus = vi.spyOn(next, "focus");
  const keyboardFocus = vi.spyOn(skip, "focus");
  press(next);
  expect(document.activeElement).toBe(next);
  expect(touchFocus).toHaveBeenCalledWith({ focusVisible: false, preventScroll: true });
  pressKey([], "Tab");
  expect(document.activeElement).toBe(skip);
  expect(keyboardFocus).toHaveBeenCalledWith();
});

it("passes P and Escape on, and takes no key or tap the modal gate refuses", () => {
  const { line, press, root, scene } = conversation();
  for (const key of ["p", "P", "Escape"]) {
    expect(pressKey([], key).stopped()).toBe(false);
  }
  const cover = Object.assign(new DialogueScene(), {
    events: new EventEmitter(),
    game: scene.game,
  });
  modalInput(cover).open();
  pressKey([], "x");
  press(root.querySelector(".ui-backdrop")!);
  expect(line()).toBe(PARAGRAPHS[0]!.text);
});

it("hides the panel and footer under a required choice, closing with its answer", async () => {
  const { opener, root, route, scene } = conversation();
  // No authored conversation ends in a choice, so this one is given one at its last line.
  const [prompt, first, second] = Object.keys(TEXT.lines);
  const choice: DialogueChoice = {
    options: [
      { id: "a", label: first! },
      { id: "b", label: second! },
    ],
    prompt: prompt!,
  };
  Object.assign(scene, { choice, paragraph: PARAGRAPHS.length - 1 });
  pressKey([], "Enter");
  expect(route.launch).toHaveBeenCalledExactlyOnceWith("dialogueChoice", { choice });
  expect(route.pause).toHaveBeenCalledOnce();
  const hidden = (selector: string) => root.querySelector<HTMLElement>(selector)!.hidden;
  expect([hidden(".dialogue-panel"), hidden(".dialogue-footer"), root.hidden]).toEqual([
    true,
    true,
    false,
  ]);
  expect(scene.pausable()).toBe(false);
  scene.choiceSelected("b");
  expect(opener.dialogueClosed).toHaveBeenCalledExactlyOnceWith("b");
  // The choice ends the conversation, so its whole view hides with it.
  expect(root.hidden).toBe(true);
  await settle();
});

it("asks a required choice as an alert dialog with no answer focused, selecting once", async () => {
  const [prompt, first, second] = Object.keys(TEXT.lines);
  const opener = { choiceSelected: vi.fn() };
  const scene = Object.assign(new DialogueChoiceScene(), {
    events: new EventEmitter(),
    game: { events: new EventEmitter() },
    scene: { get: () => opener, stop: vi.fn() },
    sys: { isActive: () => true },
  });
  scene.init({
    choice: {
      options: [
        { id: "first", label: first! },
        { id: "second", label: second! },
      ],
      prompt: prompt!,
    },
  });
  scene.create();
  await settle();
  const dialog = document.querySelector<HTMLElement>("[role=alertdialog]")!;
  expect({
    focused: document.activeElement === dialog,
    name: document.getElementById(dialog.getAttribute("aria-labelledby")!)?.textContent,
  }).toEqual({ focused: true, name: TEXT.lines[prompt!] });
  for (const key of ["Escape", "Enter"]) {
    pressKey([], key);
  }
  expect(opener.choiceSelected).not.toHaveBeenCalled();
  pressKey([], "Tab");
  pressKey([], "Tab");
  pressKey([], "Enter");
  pressKey([], "Enter");
  expect(opener.choiceSelected).toHaveBeenCalledExactlyOnceWith("second");
  scene.events.emit("shutdown");
});
