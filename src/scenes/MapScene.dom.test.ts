// @vitest-environment happy-dom
import { EventEmitter } from "node:events";

import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { mountFixtureForeground } from "./foregroundFixture.ts";

const ready = vi.hoisted(() => ({
  cancel: vi.fn(),
  finish: undefined as ((shown: boolean) => void) | undefined,
  urls: undefined as Promise<readonly string[]> | undefined,
}));
const requestUpdateCheck = vi.hoisted(() => vi.fn());
vi.mock("phaser", () => ({ Scene: class {} }));
vi.mock("../pwa/index.ts", async (original) => ({
  ...(await original<typeof import("../pwa/index.ts")>()),
  requestUpdateCheck,
}));
vi.mock("./domUi.ts", () => ({
  artFrameUrl: (_scene: unknown, art: string, frame: unknown) =>
    Promise.resolve(`blob:${art}-${String(frame)}`),
  mountSceneView: (scene: MapScene, root: HTMLElement) => {
    document.body.append(root);
    mountFixtureForeground(scene, "map", root);
    scene.events.once("shutdown", () => root.remove());
  },
  revealSceneView: (_scene: MapScene, root: HTMLElement, urls: Promise<readonly string[]>) => {
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
          queueMicrotask(() => _scene instanceof MapScene && _scene.events.emit("postupdate"));
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

function tap(target: Element, clientX = 0, clientY = 0) {
  const at = { bubbles: true, button: 0, clientX, clientY, isPrimary: true, pointerId: 1 };
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
  "restores the safe Continue default without stealing competing focus after %s",
  async (reason) => {
    const original = setup();
    ready.finish!(true);
    await Promise.resolve();
    if (reason === "unfocused default shortcut") {
      document.activeElement!.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, code: "Enter", key: "Enter" }),
      );
    } else {
      tap(original.root.querySelector('[data-control="continue"]')!);
    }
    expect(original.route.launch).toHaveBeenCalledOnce();
    original.scene.stageSelectionClosed();
    const data = original.route.restart.mock.calls[0]![0] as Parameters<MapScene["init"]>[0];
    original.events.emit("shutdown");
    const rebuilt = setup(original.scene, data);
    if (reason === "competing focus after restart") {
      const other = document.createElement("button");
      document.body.append(other);
      other.focus();
    }
    const focused = document.activeElement;
    ready.finish!(true);
    await Promise.resolve();
    expect(document.activeElement).toBe(
      reason === "unfocused default shortcut"
        ? rebuilt.root.querySelector('[data-control="continue"]')
        : focused,
    );
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

it("routes a letterbox tap through Back to title once without moving keyboard focus", async () => {
  const { root, route } = setup();
  const letterbox = root.querySelector<HTMLElement>(".map-letterbox")!;
  const view = root.querySelector<HTMLElement>(".map-view")!;
  vi.spyOn(root, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 900, 400));
  vi.spyOn(view, "getBoundingClientRect").mockReturnValue(new DOMRect(50, 0, 800, 400));
  const next = root.querySelector<HTMLButtonElement>('[data-control="continue"]')!;
  ready.finish!(true);
  await Promise.resolve();
  next.focus();
  tap(letterbox, 20, 40);
  const click = new PointerEvent("click", {
    bubbles: true,
    cancelable: true,
    detail: 1,
    pointerId: 1,
  });
  letterbox.dispatchEvent(click);
  expect(click.defaultPrevented).toBe(true);
  expect(route.start).toHaveBeenCalledExactlyOnceWith("start", { returnedToTitle: true });
  expect(route.launch).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(next);
});

it("ignores letterbox releases after a drag or ownership change, and bars outside the active range", async () => {
  const { root, route, scene } = setup();
  const letterbox = root.querySelector<HTMLElement>(".map-letterbox")!;
  const view = root.querySelector<HTMLElement>(".map-view")!;
  vi.spyOn(root, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 900, 400));
  vi.spyOn(view, "getBoundingClientRect").mockReturnValue(new DOMRect(50, 0, 800, 400));
  tap(letterbox, 20, 40);
  expect(route.start).not.toHaveBeenCalled();
  ready.finish!(true);
  await Promise.resolve();
  tap(letterbox, 55, 40);
  tap(letterbox, 920, 40);
  const pointer = (type: string, clientY: number) =>
    letterbox.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        button: 0,
        clientX: 20,
        clientY,
        isPrimary: true,
        pointerId: 1,
      }),
    );
  pointer("pointerdown", 40);
  pointer("pointermove", 80);
  pointer("pointerup", 40);
  pointer("pointerdown", 40);
  const overlay = modalInput({
    events: new EventEmitter(),
    game: scene.game,
  } as unknown as MapScene);
  overlay.open();
  pointer("pointerup", 40);
  tap(letterbox, 20, 40);
  overlay.close();
  Object.assign(scene, { travelling: true });
  tap(letterbox, 20, 40);
  expect(route.start).not.toHaveBeenCalled();
});

it("requests discovery only when a stage is admitted, once per selection", async () => {
  const { root, route, scene } = setup();
  ready.finish!(true);
  await Promise.resolve();
  scene.stageSelected(ZONE_MAP.start);
  tap(root.querySelector('[data-control="continue"]')!);
  scene.stageSelected(ZONE_MAP.destinations[1]!.stages[0]!);
  expect(route.start).not.toHaveBeenCalled();
  expect(requestUpdateCheck).not.toHaveBeenCalled();
  scene.stageSelected(ZONE_MAP.start);
  scene.stageSelected(ZONE_MAP.start);
  expect(route.start).toHaveBeenCalledExactlyOnceWith("zone", { node: ZONE_MAP.start });
  expect(requestUpdateCheck).toHaveBeenCalledOnce();
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

it("reaches Back to title with arrows and activates only the focused footer action", async () => {
  const { root, route } = setup();
  ready.finish!(true);
  await Promise.resolve();
  const key = (code: string) => {
    const target = document.activeElement!;
    target.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, cancelable: true, code, key: code }),
    );
    target.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, code, key: code }));
  };
  expect(document.activeElement).toBe(root.querySelector('[data-control="continue"]'));
  expect(route.launch).not.toHaveBeenCalled();
  key("ArrowDown");
  expect(document.activeElement).toBe(root.querySelector('[data-control="home"]'));
  expect(route.start).not.toHaveBeenCalled();
  key("Enter");
  expect(route.start).toHaveBeenCalledExactlyOnceWith("start", { returnedToTitle: true });
  expect(route.launch).not.toHaveBeenCalled();
});
