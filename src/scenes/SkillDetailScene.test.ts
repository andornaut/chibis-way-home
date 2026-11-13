// @vitest-environment happy-dom
import { EventEmitter } from "node:events";

import { fillNames } from "@andornaut/game-kit/lines";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const gate = vi.hoisted(() => ({ accepts: vi.fn(() => true), capture: vi.fn(), close: vi.fn() }));
const dom = vi.hoisted(() => ({
  backdrop: Promise.resolve(),
  layer: undefined as undefined | object,
}));
vi.mock("phaser", () => ({ Scene: class {} }));
vi.mock("./modalInput.ts", () => ({ modalInput: () => gate }));
vi.mock("./modalBackdrop.ts", () => ({ showModalBackdrop: () => ({ ready: dom.backdrop }) }));
vi.mock("./scenePalette.ts", async () => {
  const { default: palette } = await import("../../public/art/palette.json");
  return {
    paletteColour: (_scene: unknown, name: keyof typeof palette.colours) =>
      Number.parseInt(palette.colours[name].slice(1), 16),
  };
});
vi.mock("./domUi.ts", () => ({
  artFrameUrl: vi.fn(() => Promise.resolve("blob:glyph")),
  mountSceneView: (scene: { events: EventEmitter }, view: HTMLElement) => {
    const unmount = (dom.layer as UiLayer).mount(0, view);
    scene.events.once("shutdown", unmount);
    return unmount;
  },
  sceneDomUi: () => dom.layer,
}));

import dash from "../../public/art/sprites/icon-skill-dash.json" with { type: "json" };
import doubleJump from "../../public/art/sprites/icon-skill-double-jump.json" with { type: "json" };
import speedy from "../../public/art/sprites/icon-skill-speedy.json" with { type: "json" };
import { TEXT } from "../data/text.ts";
import type { ControlAction, SkillId } from "../data/types/index.ts";
import { SKILL_IDS } from "../progress/index.ts";
import { PHONE_EVENTS } from "../pwa/index.ts";
import { createUiLayer, SKILL_ART, type UiLayer } from "../ui/index.ts";
import { artFrameUrl } from "./domUi.ts";
import { SkillDetailScene } from "./SkillDetailScene.ts";

const SHEETS: Readonly<Record<string, unknown>> = {
  [SKILL_ART.dash]: dash,
  [SKILL_ART.doubleJump]: doubleJump,
  [SKILL_ART.speedy]: speedy,
};
let layer: UiLayer;
// Each launched scene's events, shut down after its test so no card's listeners outlive it.
const launched: EventEmitter[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  gate.accepts.mockReturnValue(true);
  gate.capture.mockImplementation(() => () => gate.accepts());
  dom.backdrop = Promise.resolve();
  layer = createUiLayer([], document);
  document.body.append(layer.element);
  dom.layer = layer;
});

afterEach(() => {
  launched.splice(0).forEach((events) => events.emit("shutdown"));
  layer.dispose();
});

// The scene for skill, launched and created: its card shows once its dim and glyph are ready.
function launch(skill: SkillId = "dash") {
  const events = new EventEmitter();
  launched.push(events);
  const onClose = vi.fn();
  const stop = vi.fn(() => events.emit("shutdown"));
  const scene = Object.assign(new SkillDetailScene(), {
    cache: { json: { get: (key: string) => SHEETS[key] } },
    events,
    scene: { stop },
    sys: { isActive: () => true },
  });
  scene.init({ onClose, skill });
  scene.create();
  const root = document.querySelector<HTMLElement>(".ui-scene:last-child")!;
  return { events, onClose, root, scene, stop };
}

// Lets every pending promise settle.
function settle() {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

async function openCard(skill: SkillId = "dash") {
  const launched = launch(skill);
  const waiting = launched.root.hidden;
  await settle();
  const dialog = launched.root.querySelector<HTMLElement>("[role=dialog]")!;
  const close = dialog.querySelector<HTMLButtonElement>(".ui-close-button")!;
  return { ...launched, close, dialog, waiting };
}

function key(value: string, options: KeyboardEventInit = {}) {
  const event = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    key: value,
    ...options,
  });
  (document.activeElement ?? document.body).dispatchEvent(event);
  return event;
}

function tap(target: HTMLElement) {
  const pointer = { bubbles: true, clientX: 5, clientY: 5, pointerId: 1 };
  target.dispatchEvent(new PointerEvent("pointerdown", pointer));
  target.dispatchEvent(new PointerEvent("pointerup", pointer));
  target.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
}

it.each(SKILL_IDS)(
  "shows %s's card worded from data once its dim and glyph are ready, focused on the card",
  async (skill) => {
    const { close, dialog, waiting } = await openCard(skill);
    const words = TEXT.skills[skill];
    const description = document.getElementById(dialog.getAttribute("aria-describedby")!)!;
    const tokens = [...words.description.matchAll(/\{(\w+)\}/gu)].map(
      ([, action]) => action as ControlAction,
    );
    const disc = dialog.querySelector(".ui-skill-disc")!;
    const readyFrame = (SHEETS[SKILL_ART[skill]] as typeof dash).meta.frameTags.find(
      ({ name }) => name === "ready",
    )!.from;
    expect({
      close: close.getAttribute("aria-label"),
      description: description.textContent,
      disc: [disc.getAttribute("role"), disc.getAttribute("aria-label")],
      focused: document.activeElement === dialog,
      glyph: dialog.querySelector<HTMLImageElement>(".ui-skill-disc-glyph")?.src,
      icons: [...description.querySelectorAll("[role=img]")].map((icon) =>
        icon.getAttribute("aria-label"),
      ),
      modal: dialog.getAttribute("aria-modal"),
      name: document.getElementById(dialog.getAttribute("aria-labelledby")!)?.textContent,
      waiting,
    }).toEqual({
      close: TEXT.skillDetails.close,
      description: words.description.replace(
        /\{(\w+)\}/gu,
        (_, action: ControlAction) => TEXT.buttons[action],
      ),
      disc: ["img", fillNames(TEXT.skillDetails.disc, { skill: words.title })],
      focused: true,
      glyph: "blob:glyph",
      icons: tokens.map((action) => TEXT.actionIcons[action]),
      modal: "true",
      name: words.title,
      waiting: true,
    });
    expect(tokens.length).toBeGreaterThan(0);
    expect(artFrameUrl).toHaveBeenCalledWith(
      expect.anything(),
      SKILL_ART[skill],
      Object.keys((SHEETS[SKILL_ART[skill]] as typeof dash).frames)[readyFrame],
      "ink",
    );
  },
);

it.each([
  ["the close X", ({ close }: Awaited<ReturnType<typeof openCard>>) => tap(close)],
  ["Escape", () => key("Escape")],
  ["Enter on the card", () => key("Enter")],
  ["Space on the card", () => key(" ")],
  ["back", () => window.dispatchEvent(new Event(PHONE_EVENTS.backPressed))],
  [
    "a tap outside",
    ({ root }: Awaited<ReturnType<typeof openCard>>) =>
      tap(root.querySelector<HTMLElement>(".ui-backdrop")!),
  ],
] as const)("closes once for %s and tells the opener after its input closes", async (_, act) => {
  const card = await openCard();
  act(card);
  act(card);
  expect(card.stop).toHaveBeenCalledOnce();
  expect(gate.close).toHaveBeenCalledOnce();
  expect(card.onClose).toHaveBeenCalledOnce();
  expect(gate.close.mock.invocationCallOrder[0]).toBeLessThan(
    card.onClose.mock.invocationCallOrder[0]!,
  );
  expect(card.dialog.isConnected).toBe(false);
});

it("moves the focus to the close X with Tab and the arrows, and presses it with Enter", async () => {
  const { close, onClose } = await openCard();
  const steps = (["Tab", "ArrowRight", "ArrowLeft"] as const).map((value) => {
    key(value);
    return document.activeElement === close;
  });
  expect(steps).toEqual([true, true, true]);
  key("Enter");
  expect(onClose).toHaveBeenCalledOnce();
});

it("stays open for P, a held Enter, a tap on the card and input the modal gate refuses", async () => {
  const { close, dialog, onClose, root } = await openCard();
  for (const value of ["P", "p"]) {
    expect(key(value).defaultPrevented).toBe(false);
  }
  key("Enter", { repeat: true });
  tap(dialog);
  gate.accepts.mockReturnValue(false);
  key("Escape");
  key("Enter");
  close.click();
  tap(root.querySelector<HTMLElement>(".ui-backdrop")!);
  window.dispatchEvent(new Event(PHONE_EVENTS.backPressed));
  expect(onClose).not.toHaveBeenCalled();
  expect(dialog.isConnected).toBe(true);
});

it("takes no close before its dim is ready, and ignores a previous visit's late readiness", async () => {
  const pending = () => {
    let resolve!: () => void;
    const promise = new Promise<void>((done) => {
      resolve = done;
    });
    return { promise, resolve };
  };
  const first = pending();
  dom.backdrop = first.promise;
  const { onClose, root, scene } = launch();
  window.dispatchEvent(new Event(PHONE_EVENTS.backPressed));
  expect(onClose).not.toHaveBeenCalled();
  // Relaunched before the first visit's dim is ready: its readiness must not show the new card.
  scene.events.emit("shutdown");
  dom.backdrop = pending().promise;
  const current = vi.fn();
  scene.init({ onClose: current, skill: "dash" });
  scene.create();
  first.resolve();
  await settle();
  window.dispatchEvent(new Event(PHONE_EVENTS.backPressed));
  expect(onClose).not.toHaveBeenCalled();
  expect(current).not.toHaveBeenCalled();
  expect(root.isConnected).toBe(false);
  expect(document.querySelector<HTMLElement>(".ui-scene:last-child")!.hidden).toBe(true);
});
