// @vitest-environment happy-dom
import { EventEmitter } from "node:events";

import { type AsepriteSheet, sheetTags } from "@andornaut/game-kit/art/aseprite";
import { afterEach, expect, it, vi } from "vitest";

import pug from "../../public/art/sprites/dog-pug.json" with { type: "json" };
import dash from "../../public/art/sprites/icon-skill-dash.json" with { type: "json" };
import type { RoomView } from "../ui/index.ts";

vi.mock("phaser", () => ({
  Input: {},
  Scale: {},
  Scene: class {},
  Scenes: { Events: { PRE_RENDER: "prerender" } },
}));
vi.mock("./save.ts", () => ({ grantSkill: vi.fn() }));
vi.mock("./modalInput.ts", () => ({
  modalInput: () => ({
    accepts: () => true,
    capture: () => () => true,
    ready: vi.fn(),
    subscribe: () => {},
  }),
}));
vi.mock("./domUi.ts", () => ({
  artFrameUrl: vi.fn(async (_scene, art, frame) => `blob:${art}:${frame}`),
  mountSceneView: vi.fn(),
  revealSceneView: vi.fn(),
  sceneDomUi: () => ({ element: document.createElement("div") }),
}));
vi.mock("./scenePalette.ts", () => ({ paletteColour: () => 0 }));

import { artFrameUrl, revealSceneView } from "./domUi.ts";
import { RoomScene } from "./RoomScene.ts";

afterEach(() => vi.clearAllMocks());

function fixture() {
  let resolve: (shown: boolean) => void = () => {};
  const revealed = new Promise<boolean>((done) => {
    resolve = done;
  });
  const cancel = vi.fn();
  vi.mocked(revealSceneView).mockImplementation((_scene, root) => {
    root.hidden = true;
    root.inert = true;
    return { cancel, revealed };
  });
  const events = new EventEmitter();
  const controller = { resume: vi.fn(), setVisible: vi.fn(), stop: vi.fn() };
  const idle = sheetTags(pug as AsepriteSheet).get("idle")!;
  const portrait = { frame: { name: idle[0]!.frame }, height: 32, width: 44 };
  const room = new RoomScene();
  room.init({ room: "dash-gift", stage: "street" });
  Object.assign(room, {
    cache: { json: { get: (key: string) => (key === "dog-pug" ? pug : dash) } },
    events,
    portrait,
    scene: controller,
  });
  const scene = room as unknown as { createDomView(): void; view: RoomView };
  scene.createDomView();
  return { cancel, controller, events, idle, portrait, resolve, scene };
}

it("hands off only after all idle frames decode, follows the native portrait frame and leaves once", async () => {
  const { controller, events, idle, portrait, resolve, scene } = fixture();
  scene.view.leave.click();
  expect(controller.resume).not.toHaveBeenCalled();
  const urls = await vi.mocked(revealSceneView).mock.calls[0]![2];
  expect(urls).toHaveLength(idle.length + 1);
  expect(artFrameUrl).toHaveBeenCalledTimes(idle.length + 1);
  resolve(true);
  await Promise.resolve();
  const image = scene.view.panel!.portrait;
  expect(image.src).toBe(`blob:dog-pug:${idle[0]!.frame}`);
  expect(image.style.getPropertyValue("--room-portrait-width")).toBe(String(portrait.width));
  const src = vi.spyOn(image, "src", "set");
  events.emit("prerender");
  expect(src).not.toHaveBeenCalled();
  portrait.frame.name = idle[1]!.frame;
  events.emit("prerender");
  expect(src).toHaveBeenCalledExactlyOnceWith(`blob:dog-pug:${idle[1]!.frame}`);
  scene.view.leave.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Tab" }));
  scene.view.leave.dispatchEvent(
    new KeyboardEvent("keydown", { bubbles: true, key: "Enter", repeat: true }),
  );
  expect(controller.resume).not.toHaveBeenCalled();
  scene.view.leave.click();
  scene.view.leave.click();
  expect(controller.resume).toHaveBeenCalledExactlyOnceWith("zone");
  expect(controller.stop).toHaveBeenCalledOnce();
});

it("cancels a pending room handoff on shutdown without enabling stale controls", async () => {
  const { cancel, controller, events, resolve, scene } = fixture();
  const view = scene.view;
  await vi.mocked(revealSceneView).mock.calls[0]![2];
  events.emit("shutdown");
  resolve(true);
  await Promise.resolve();
  view.leave.click();
  expect(cancel).toHaveBeenCalledOnce();
  expect(controller.resume).not.toHaveBeenCalled();
  expect(events.listenerCount("prerender")).toBe(0);
});
