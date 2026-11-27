// @vitest-environment happy-dom
import { EventEmitter } from "node:events";

import { afterEach, expect, it, vi } from "vitest";

import { mountFixtureForeground } from "./foregroundFixture.ts";

const dom = vi.hoisted(() => ({ layer: undefined as unknown }));
// Exit's window close, and the page exit handler, which may navigate.
const exit = vi.hoisted(() => vi.fn());
const leave = vi.hoisted(() => vi.fn());
vi.mock("phaser", () => ({ Core: { Events: { POST_RENDER: "postrender" } }, Scene: class {} }));
vi.mock("@andornaut/game-kit/runtime/web/pwa/dom/exitApp", () => ({
  browserExitPage: () => "/",
  exitApp: leave,
}));
vi.mock("../ui/input/frameTurn.ts", () => ({ frameTurn: () => ({ onChange: () => () => {} }) }));
vi.mock("../pwa/index.ts", () => ({
  PHONE_EVENTS: { backPressed: "phone-back" },
  backLeavesGame: () => true,
  closeApp: exit,
  exitShown: () => true,
  startWakeLock: vi.fn(),
  stopWakeLock: vi.fn(),
  updateOffer: { defer: vi.fn() },
}));
vi.mock("./save.ts", () => ({
  activeSkill: () => undefined,
  savedProgress: () => ({ at: "beginning" }),
  savedSkills: () => [],
}));
vi.mock("./keyboardCapture.ts", () => ({ captureTab: vi.fn() }));
vi.mock("./playCamera.ts", () => ({ fitPlayCamera: vi.fn() }));
vi.mock("./modalBackdrop.ts", () => ({
  showModalBackdrop: () => ({ destroy: vi.fn(), ready: Promise.resolve(), setVisible: vi.fn() }),
}));
vi.mock("./domUi.ts", () => ({
  artFrameUrl: () => Promise.resolve("blob:art"),
  mountSceneView: (scene: StartScene, root: HTMLElement) => {
    root.dataset.menuScene = scene.scene.key;
    const unmount = (dom.layer as UiLayer).mount(0, root);
    mountFixtureForeground(scene, "start", root);
    scene.events.once("shutdown", unmount);
    return unmount;
  },
  revealSceneView: () => ({ cancel: vi.fn(), revealed: Promise.resolve(true) }),
  sceneDomUi: () => dom.layer,
}));

import palette from "../../public/art/palette.json" with { type: "json" };
import { TEXT } from "../data/text.ts";
import { createUiLayer, type UiLayer } from "../ui/index.ts";
import { modalInput } from "./modalInput.ts";
import { createPauseScene, settle, tap } from "./pauseFixture.ts";
import { StartScene } from "./StartScene.ts";

const cleanup: (() => void)[] = [];
afterEach(() => {
  cleanup.splice(0).forEach((stop) => stop());
  exit.mockClear();
  leave.mockClear();
});

async function startMenu() {
  const layer = createUiLayer([], document);
  dom.layer = layer;
  document.body.append(layer.element);
  const game = { events: new EventEmitter() };
  const active = new Set(["start", "pause"]),
    paused = new Set<string>();
  const events = new EventEmitter(),
    keyboard = new EventEmitter();
  const start = Object.assign(new StartScene(), {
    add: { image: () => ({ setOrigin: vi.fn() }) },
    cache: { json: { get: () => palette } },
    cameras: { main: { setBackgroundColor: vi.fn() } },
    events,
    game,
    input: { keyboard },
    scene: { key: "start", start: vi.fn() },
    sys: { isActive: () => active.has("start") },
    textures: { getFrame: () => ({ realHeight: 239, realWidth: 558 }) },
  });
  const pause = createPauseScene(game, {
    get: (key) =>
      key === "start"
        ? start
        : {
            playCovered: () => false,
            skillState: () => undefined,
          },
    isActive: (key) => active.has(key),
    isPaused: (key) => paused.has(key),
    key: "pause",
    launch: vi.fn(),
    pause: (key) => {
      active.delete(key);
      paused.add(key);
    },
    resume: (key) => {
      paused.delete(key);
      active.add(key);
    },
    stop: vi.fn(),
  });
  // Model native blur when disabling a focused button, which Happy DOM keeps focused.
  const disabled = Object.getOwnPropertyDescriptor(HTMLButtonElement.prototype, "disabled")!;
  Object.defineProperty(pause.pauseButton, "disabled", {
    configurable: true,
    get: () => disabled.get!.call(pause.pauseButton) as boolean,
    set: (value: boolean) => {
      if (value && document.activeElement === pause.pauseButton) {
        pause.pauseButton.blur();
      }
      disabled.set!.call(pause.pauseButton, value);
    },
  });
  start.create();
  await settle();
  events.emit("postupdate");
  pause.update();
  // Phaser's KeyboardManager listens on window after the DOM controller handlers.
  const forward = (event: KeyboardEvent) => {
    if (!event.defaultPrevented) {
      keyboard.emit("keydown", event);
    }
  };
  window.addEventListener("keydown", forward);
  cleanup.push(() => {
    window.removeEventListener("keydown", forward);
    events.emit("shutdown");
    pause.events.emit("shutdown");
    game.events.emit("destroy");
    layer.dispose();
  });
  const key = (value: string, repeat = false) => {
    const event = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: value,
      repeat,
    });
    document.activeElement!.dispatchEvent(event);
    return event;
  };
  return { game, key, layer, pause, start };
}

it.each(["Enter", " "])(
  "owns %j on the focused global Menu entry before the underlying Start Exit handler",
  async (activation) => {
    const f = await startMenu();
    expect(document.activeElement?.textContent).toBe(TEXT.start.start);
    f.key("Tab");
    expect(document.activeElement?.getAttribute("aria-label")).toBe(TEXT.start.exit);
    f.key("Tab");
    expect(document.activeElement).toBe(f.pause.pauseButton);
    expect(f.key(activation, true).defaultPrevented).toBe(true);
    expect(f.pause.dialog.closest<HTMLElement>(".ui-card-scene")!.hidden).toBe(true);
    modalInput(f.start).ready(false);
    expect(f.key(activation).defaultPrevented).toBe(true);
    expect(f.pause.dialog.closest<HTMLElement>(".ui-card-scene")!.hidden).toBe(true);
    expect(exit).not.toHaveBeenCalled();
    modalInput(f.start).ready(true);
    const activationEvent = f.key(activation);
    expect(exit).not.toHaveBeenCalled();
    expect(activationEvent.defaultPrevented).toBe(true);
    await settle();
    expect(f.start.scene.start).not.toHaveBeenCalled();
    expect(f.pause.dialog.closest<HTMLElement>(".ui-card-scene")!.hidden).toBe(false);
    expect(f.pause.dialog.querySelector(".ui-card-title")?.textContent).toBe(TEXT.menu.title);
    expect(document.activeElement).toBe(f.pause.dialog);
    expect(f.key(activation, true).defaultPrevented).toBe(true);
    const release = new KeyboardEvent("keyup", {
      bubbles: true,
      cancelable: true,
      key: activation,
    });
    document.activeElement!.dispatchEvent(release);
    if (activation === " ") {
      expect(release.defaultPrevented).toBe(true);
    }
    expect(f.pause.dialog.closest<HTMLElement>(".ui-card-scene")!.hidden).toBe(false);
    tap(f.pause.button(TEXT.pause.close));
    f.game.events.emit("postrender");
    expect(document.activeElement).toBe(f.pause.pauseButton);
    expect(f.key(activation, true).defaultPrevented).toBe(true);
    expect(f.pause.dialog.closest<HTMLElement>(".ui-card-scene")!.hidden).toBe(true);
    expect(exit).not.toHaveBeenCalled();
  },
);

it("returns keyboard focus to the Menu entry after native disabled-button blur and Escape", async () => {
  const f = await startMenu();
  f.key("Tab");
  f.key("Tab");
  expect(document.activeElement).toBe(f.pause.pauseButton);
  f.key("Enter");
  await settle();
  expect(document.activeElement).toBe(f.pause.dialog);
  f.key("Escape");
  f.game.events.emit("postrender");
  await settle();
  expect(f.pause.dialog.closest<HTMLElement>(".ui-card-scene")!.hidden).toBe(true);
  expect(document.activeElement).toBe(f.pause.pauseButton);
  f.key(" ");
  await settle();
  expect(exit).not.toHaveBeenCalled();
  expect(f.start.scene.start).not.toHaveBeenCalled();
  expect(f.pause.dialog.closest<HTMLElement>(".ui-card-scene")!.hidden).toBe(false);
});

it("cannot activate or route Tab to Menu underneath an ordinary modal", async () => {
  const f = await startMenu();
  const dialog = document.createElement("section");
  const action = document.createElement("button");
  dialog.append(action);
  f.layer.mount(1, dialog);
  const close = f.layer.modals.open({}, dialog);
  f.pause.update();
  expect(f.pause.pauseButton.closest("[inert]")).not.toBeNull();
  f.pause.pauseButton.click();
  await settle();
  expect(f.pause.dialog.closest<HTMLElement>(".ui-card-scene")!.hidden).toBe(true);
  action.focus();
  f.key("Tab");
  expect(document.activeElement).toBe(action);
  expect(exit).not.toHaveBeenCalled();
  close();
});

it.each(["keyboard", "glyph tap"])(
  "closes the app window from Exit by %s without navigating",
  async (input) => {
    const f = await startMenu();
    if (input === "keyboard") {
      f.key("Tab");
      expect(document.activeElement?.getAttribute("aria-label")).toBe(TEXT.start.exit);
      f.key("Enter");
    } else {
      tap(f.layer.element.querySelector('[data-control="exit"] svg path')!);
    }
    expect(exit).toHaveBeenCalledOnce();
    expect(leave).not.toHaveBeenCalled();
  },
);
