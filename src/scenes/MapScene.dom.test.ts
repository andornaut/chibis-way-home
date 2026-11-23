// @vitest-environment happy-dom
import { EventEmitter } from "node:events";

import { afterEach, beforeEach, expect, it, vi } from "vitest";

const ready = vi.hoisted(() => ({
  cancel: vi.fn(),
  finish: undefined as ((shown: boolean) => void) | undefined,
  urls: undefined as Promise<readonly string[]> | undefined,
}));
vi.mock("phaser", () => ({ Scene: class {} }));
vi.mock("./domUi.ts", () => ({
  artFrameUrl: (_scene: unknown, art: string, frame: unknown) =>
    Promise.resolve(`blob:${art}-${String(frame)}`),
  mountSceneView: (scene: { events: EventEmitter }, root: HTMLElement) => {
    document.body.append(root);
    scene.events.once("shutdown", () => root.remove());
  },
  revealSceneView: (_scene: unknown, root: HTMLElement, urls: Promise<readonly string[]>) => {
    ready.urls = urls;
    root.hidden = true;
    root.inert = true;
    return {
      cancel: ready.cancel,
      revealed: new Promise<boolean>((resolve) => {
        ready.finish = (shown) => {
          root.hidden = !shown;
          root.inert = !shown;
          resolve(shown);
        };
      }),
    };
  },
  sceneDomUi: () => ({ element: document.body }),
}));
vi.mock("./save.ts", () => ({
  mapFullyOpen: () => false,
  saveStand: vi.fn(),
  savedMap: () => ({ completed: [], stand: "" }),
}));

import birdSheet from "../../public/art/sprites/bird.json" with { type: "json" };
import markerSheet from "../../public/art/sprites/map-zone.json" with { type: "json" };
import { ZONE_MAP } from "../data/map.ts";
import { SCREEN } from "../data/screen.ts";
import { TEXT } from "../data/text.ts";
import { MapScene } from "./MapScene.ts";
import { modalInput } from "./modalInput.ts";

const cleanups: (() => void)[] = [];
beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  cleanups.splice(0).forEach((stop) => stop());
  document.body.replaceChildren();
});

function setup(scene = new MapScene(), data: Parameters<MapScene["init"]>[0] = {}) {
  const events = new EventEmitter();
  const route = { launch: vi.fn(), restart: vi.fn(), start: vi.fn() };
  Object.assign(scene, {
    cache: { json: { get: (key: string) => (key === "bird" ? birdSheet : markerSheet) } },
    events,
    game: Reflect.get(scene, "game") ?? { events: new EventEmitter() },
    input: { enabled: true },
    scene: route,
    sys: { settings: { data } },
    textures: { getFrame: () => ({ cutHeight: 14, cutWidth: 14 }) },
  });
  scene.init(data);
  (Reflect.get(scene, "addDom") as () => void).call(scene);
  cleanups.push(() => events.emit("shutdown"));
  const root = document.querySelector<HTMLElement>(".map-scene")!;
  return { events, root, route, scene };
}

function tap(target: Element) {
  const at = { bubbles: true, button: 0, clientX: 0, clientY: 0, isPrimary: true, pointerId: 1 };
  target.dispatchEvent(new PointerEvent("pointerdown", at));
  target.dispatchEvent(new PointerEvent("pointerup", at));
}

it("keeps native input disabled through decoding until successful reveal", async () => {
  const { root, route } = setup();
  const next = root.querySelector<HTMLButtonElement>('[data-control="continue"]')!;
  tap(next);
  expect(route.launch).not.toHaveBeenCalled();
  expect(root.hidden).toBe(true);
  ready.finish!(true);
  await Promise.resolve();
  expect(next.textContent).toBe(TEXT.map.continue);
  const critical = await ready.urls!;
  const walk = birdSheet.meta.frameTags.find(({ name }) => name === "walk")!;
  expect(critical.filter((url) => url.startsWith("blob:bird-")).length).toBe(
    walk.to - walk.from + 1,
  );
  const marker = root.querySelector<HTMLImageElement>(".map-marker[data-miniature]")!;
  expect(marker.style.getPropertyValue("--map-miniature-image")).toContain(
    ZONE_MAP.destinations[0]!.icon,
  );
  expect(
    critical.some((url) => marker.style.getPropertyValue("--map-miniature-image").includes(url)),
  ).toBe(true);
  tap(root.querySelector('[data-state="current"]')!);
  expect(route.launch).not.toHaveBeenCalled();
  tap(next);
  expect(route.launch).toHaveBeenCalledExactlyOnceWith("stageSelect", {
    destination: ZONE_MAP.destinations[0]!.id,
  });
});

it("restores the focused Continue on the rebuilt map only after reveal", async () => {
  const original = setup();
  ready.finish!(true);
  await Promise.resolve();
  const next = original.root.querySelector<HTMLButtonElement>('[data-control="continue"]')!;
  tap(next);
  expect(document.activeElement).toBe(next);
  expect(original.route.launch).toHaveBeenCalledOnce();
  original.scene.stageSelectionClosed();
  expect(original.route.restart).toHaveBeenCalledExactlyOnceWith({ restoreContinueFocus: true });

  original.events.emit("shutdown");
  const data = original.route.restart.mock.calls[0]![0] as Parameters<MapScene["init"]>[0];
  const rebuilt = setup(original.scene, data);
  const replacement = rebuilt.root.querySelector<HTMLButtonElement>('[data-control="continue"]')!;
  expect(next.isConnected).toBe(false);
  expect(document.activeElement).not.toBe(replacement);
  ready.finish!(true);
  await Promise.resolve();
  expect(document.activeElement).toBe(replacement);
});

it.each(["unfocused default shortcut", "competing focus after restart"])(
  "does not assign Continue focus after %s",
  async (reason) => {
    const original = setup();
    ready.finish!(true);
    await Promise.resolve();
    if (reason === "unfocused default shortcut") {
      original.root.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, code: "Enter" }));
    } else {
      tap(original.root.querySelector('[data-control="continue"]')!);
    }
    expect(original.route.launch).toHaveBeenCalledOnce();
    original.scene.stageSelectionClosed();
    const data = original.route.restart.mock.calls[0]![0] as Parameters<MapScene["init"]>[0];
    original.events.emit("shutdown");
    setup(original.scene, data);
    if (reason === "competing focus after restart") {
      const other = document.createElement("button");
      document.body.append(other);
      other.focus();
    }
    const focused = document.activeElement;
    ready.finish!(true);
    await Promise.resolve();
    expect(document.activeElement).toBe(focused);
  },
);

it("rejects a tap crossing modal ownership and leaves travel input locked", async () => {
  const { root, route, scene } = setup();
  ready.finish!(true);
  await Promise.resolve();
  const next = root.querySelector<HTMLButtonElement>('[data-control="continue"]')!;
  next.dispatchEvent(
    new PointerEvent("pointerdown", { bubbles: true, button: 0, isPrimary: true, pointerId: 1 }),
  );
  modalInput(scene).open();
  modalInput(scene).close();
  next.dispatchEvent(
    new PointerEvent("pointerup", { bubbles: true, button: 0, isPrimary: true, pointerId: 1 }),
  );
  expect(route.launch).not.toHaveBeenCalled();
  Object.assign(scene, { travelling: true });
  tap(next);
  next.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 0 }));
  root.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, code: "Enter" }));
  expect(route.launch).not.toHaveBeenCalled();
});

it("marks the Map Back to title action as a return to Start", async () => {
  const { root, route } = setup();
  const home = root.querySelector<HTMLButtonElement>('[data-control="home"]')!;
  tap(home);
  expect(route.start).not.toHaveBeenCalled();
  ready.finish!(true);
  await Promise.resolve();
  tap(home);
  expect(route.start).toHaveBeenCalledExactlyOnceWith("start", { returnedToTitle: true });
});

it("does not hand off a failed or shutdown reveal", async () => {
  const failed = setup();
  ready.finish!(false);
  await Promise.resolve();
  failed.events.emit("shutdown");
  const stale = setup();
  stale.events.emit("shutdown");
  ready.finish!(true);
  await Promise.resolve();
  expect(ready.cancel).toHaveBeenCalled();
});

it("positions the exact travel frame mask at the sprite origin in both facings", () => {
  const { root, scene } = setup();
  const view = root.querySelector<HTMLElement>(".map-view")!;
  const bird = {
    displayHeight: 21,
    displayWidth: 26,
    flipX: false,
    frame: { name: "pose" },
    originX: 0.5,
    originY: 1,
    x: 110,
    y: 80,
  };
  Object.assign(scene, { birdFrames: new Map([["pose", "blob:pose"]]), journey: { bird } });
  const mask = Reflect.get(scene, "maskTravelBird") as () => void;
  mask.call(scene);
  expect(view.style.getPropertyValue("--map-bird-image")).toBe('url("blob:pose")');
  expect(Number(view.style.getPropertyValue("--map-bird-x"))).toBe(97);
  expect(Number(view.style.getPropertyValue("--map-bird-y"))).toBe(59);
  expect(view.hasAttribute("data-bird-flipped")).toBe(false);
  bird.flipX = true;
  mask.call(scene);
  expect(Number(view.style.getPropertyValue("--map-bird-x"))).toBe(SCREEN.width - 97 - 26);
  expect(view.hasAttribute("data-bird-flipped")).toBe(true);
  expect(root.hasAttribute("data-bird-flipped")).toBe(false);
  expect(root.style.getPropertyValue("--map-bird-image")).toBe("");
});
