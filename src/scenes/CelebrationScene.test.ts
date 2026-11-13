// @vitest-environment happy-dom
import { EventEmitter } from "node:events";

import { afterEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  cancel: vi.fn(),
  ready: true,
  resolve: undefined as undefined | ((ready: boolean) => void),
}));
vi.mock("phaser", () => ({ Scene: class {} }));
vi.mock("./playCamera.ts", () => ({ fitPlayCamera: vi.fn() }));
vi.mock("./cardParts.ts", () => ({
  BODY_FONT: "body",
  addButtonLabel: () => ({}),
  addCardText: vi.fn(),
  addCardTitle: vi.fn(),
  addSlice: vi.fn(),
  addTextButton: () => ({}),
  captureTab: vi.fn(),
  paletteColour: () => 0,
  placeButtonLabel: vi.fn(),
  pressTextButton: vi.fn(),
  ringFocus: vi.fn(),
}));
vi.mock("./modalInput.ts", () => ({
  modalInput: () => ({
    accepts: () => state.ready,
    capture: () => () => state.ready,
    ready: (ready: boolean) => {
      state.ready = ready;
    },
    subscribe: vi.fn(),
  }),
}));
vi.mock("./domUi.ts", () => ({
  artFrameUrl: () => Promise.resolve("blob:art"),
  mountSceneView: (scene: { events: EventEmitter }, root: HTMLElement) => {
    document.body.append(root);
    scene.events.once("shutdown", () => root.remove());
  },
  revealSceneView: (_scene: unknown, root: HTMLElement) => {
    root.hidden = true;
    root.inert = true;
    return {
      cancel: state.cancel,
      revealed: new Promise<boolean>((resolve) => {
        state.resolve = (ready) => {
          root.hidden = !ready;
          root.inert = !ready;
          resolve(ready);
        };
      }),
    };
  },
}));

import { CelebrationScene } from "./CelebrationScene.ts";

function setup() {
  state.ready = true;
  state.cancel.mockClear();
  const scene = new CelebrationScene();
  const events = new EventEmitter();
  const fallback = { destroy: vi.fn() };
  const start = vi.fn();
  const launch = vi.fn();
  Object.assign(scene, {
    add: { sprite: () => ({ setOrigin: () => ({ play: vi.fn() }) }) },
    cache: {
      json: {
        get: () => ({
          frames: [{ duration: 1, filename: "face" }],
          meta: {
            frameTags: [
              { direction: "forward", from: 0, name: "normal", to: 0 },
              { direction: "forward", from: 0, name: "pressed", to: 0 },
              { direction: "forward", from: 0, name: "rest", to: 0 },
            ],
          },
        }),
      },
    },
    cameras: { main: { setBackgroundColor: vi.fn() } },
    children: { list: [fallback] },
    events,
    scene: { key: "celebration", launch, start },
  });
  scene.create();
  return { events, fallback, launch, scene, start };
}
const key = (name: string, repeat = false) =>
  document.dispatchEvent(
    new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: name, repeat }),
  );
afterEach(() => {
  document.body.replaceChildren();
});

it("keeps the canvas fallback and blocks input until reveal, then Continue acts once", async () => {
  const { events, fallback, start } = setup();
  key("Enter");
  expect(start).not.toHaveBeenCalled();
  expect(fallback.destroy).not.toHaveBeenCalled();
  state.resolve!(true);
  await Promise.resolve();
  expect(fallback.destroy).toHaveBeenCalledOnce();
  key("Enter", true);
  expect(start).not.toHaveBeenCalled();
  key("Enter");
  key("Enter");
  expect(start).toHaveBeenCalledExactlyOnceWith("map");
  events.emit("shutdown");
});

it("delegates keys while Restart is open and restores Restart focus on cancellation", async () => {
  const { events, launch, scene, start } = setup();
  state.resolve!(true);
  await Promise.resolve();
  key("Tab");
  expect((document.activeElement as HTMLElement).dataset.action).toBe("continue");
  key("Tab");
  expect((document.activeElement as HTMLElement).dataset.action).toBe("restart");
  key("Enter");
  key("Enter");
  expect(launch).toHaveBeenCalledExactlyOnceWith("restart", { opener: "celebration" });
  expect(start).not.toHaveBeenCalled();
  scene.restartClosed();
  expect((document.activeElement as HTMLElement).dataset.action).toBe("restart");
  events.emit("shutdown");
});

it("cancels shutdown readiness without destroying the fallback or accepting stale input", async () => {
  const { events, fallback, start } = setup();
  events.emit("shutdown");
  state.resolve!(true);
  await Promise.resolve();
  key("Enter");
  expect(state.cancel).toHaveBeenCalledOnce();
  expect(fallback.destroy).not.toHaveBeenCalled();
  expect(start).not.toHaveBeenCalled();
});
