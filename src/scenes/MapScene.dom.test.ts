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
  mountSceneView: (_scene: unknown, root: HTMLElement) => document.body.append(root),
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
  saveStand: vi.fn(),
  savedMap: () => ({ completed: [], stand: "" }),
}));

import birdSheet from "../../public/art/sprites/bird.json" with { type: "json" };
import markerSheet from "../../public/art/sprites/map-zone.json" with { type: "json" };
import { ZONE_MAP } from "../data/map.ts";
import { SCREEN } from "../data/screen.ts";
import { TEXT } from "../data/text.ts";
import { openMap } from "../progress/index.ts";
import { MapScene } from "./MapScene.ts";
import { modalInput } from "./modalInput.ts";

const cleanups: (() => void)[] = [];
beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  cleanups.splice(0).forEach((stop) => stop());
  document.body.replaceChildren();
});

function setup() {
  const scene = new MapScene();
  const events = new EventEmitter();
  const hidden = { setVisible: vi.fn() };
  const face = () => ({ faces: { normal: hidden, pressed: hidden }, label: { label: hidden } });
  const route = { launch: vi.fn(), restart: vi.fn(), start: vi.fn() };
  Object.assign(scene, {
    buttons: { continue: face(), home: face() },
    cache: { json: { get: (key: string) => (key === "bird" ? birdSheet : markerSheet) } },
    completed: new Set(),
    events,
    fallback: [hidden],
    game: { events: new EventEmitter() },
    generation: 1,
    open: openMap(ZONE_MAP, new Set()),
    scene: route,
    stand: ZONE_MAP.start,
    textures: { getFrame: () => ({ cutHeight: 14, cutWidth: 14 }) },
  });
  (Reflect.get(scene, "addDom") as () => void).call(scene);
  cleanups.push(() => events.emit("shutdown"));
  const root = document.querySelector<HTMLElement>(".map-view")!;
  return { events, hidden, root, route, scene };
}

function tap(target: Element) {
  const at = { bubbles: true, clientX: 0, clientY: 0, pointerId: 1 };
  target.dispatchEvent(new PointerEvent("pointerdown", at));
  target.dispatchEvent(new PointerEvent("pointerup", at));
}

it("keeps the canvas fallback through decoding and hands off only on successful reveal", async () => {
  const { hidden, root, route } = setup();
  const next = root.querySelector<HTMLButtonElement>('[data-control="continue"]')!;
  tap(next);
  expect(route.launch).not.toHaveBeenCalled();
  expect(root.hidden).toBe(true);
  expect(hidden.setVisible).not.toHaveBeenCalled();
  ready.finish!(true);
  await Promise.resolve();
  expect(hidden.setVisible).toHaveBeenCalledWith(false);
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

it("rejects a tap crossing modal ownership and leaves travel input locked", async () => {
  const { root, route, scene } = setup();
  ready.finish!(true);
  await Promise.resolve();
  const next = root.querySelector<HTMLButtonElement>('[data-control="continue"]')!;
  next.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1 }));
  modalInput(scene).open();
  modalInput(scene).close();
  next.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }));
  expect(route.launch).not.toHaveBeenCalled();
  Object.assign(scene, { travelling: true });
  tap(next);
  next.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 0 }));
  root.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, code: "Enter" }));
  expect(route.launch).not.toHaveBeenCalled();
});

it("does not hand off a failed or shutdown reveal", async () => {
  const failed = setup();
  ready.finish!(false);
  await Promise.resolve();
  expect(failed.hidden.setVisible).not.toHaveBeenCalled();
  failed.events.emit("shutdown");
  const stale = setup();
  stale.events.emit("shutdown");
  ready.finish!(true);
  await Promise.resolve();
  expect(stale.hidden.setVisible).not.toHaveBeenCalled();
  expect(ready.cancel).toHaveBeenCalled();
});

it("positions the exact travel frame mask at the sprite origin in both facings", () => {
  const { root, scene } = setup();
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
  expect(root.style.getPropertyValue("--map-bird-image")).toBe('url("blob:pose")');
  expect(Number(root.style.getPropertyValue("--map-bird-x"))).toBe(97);
  expect(Number(root.style.getPropertyValue("--map-bird-y"))).toBe(59);
  expect(root.hasAttribute("data-bird-flipped")).toBe(false);
  bird.flipX = true;
  mask.call(scene);
  expect(Number(root.style.getPropertyValue("--map-bird-x"))).toBe(SCREEN.width - 97 - 26);
  expect(root.hasAttribute("data-bird-flipped")).toBe(true);
});
