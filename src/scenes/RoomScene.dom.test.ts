// @vitest-environment happy-dom
import { EventEmitter } from "node:events";

import { type AsepriteSheet, sheetTags } from "@andornaut/game-kit/runtime/art/aseprite";
import { afterEach, expect, it, vi } from "vitest";

import pug from "../../public/art/sprites/dog-pug.json" with { type: "json" };
import dash from "../../public/art/sprites/icon-skill-dash.json" with { type: "json" };
import { GIFT_CONVERSATIONS } from "../data/dialogues.ts";
import { ZONE_MAP } from "../data/map.ts";
import { TEXT } from "../data/text.ts";
import type { RoomView } from "../ui/index.ts";

vi.mock("phaser", () => ({
  Input: {},
  Scale: {},
  Scene: class {},
  Scenes: { Events: { PRE_RENDER: "prerender" } },
}));
vi.mock("./save.ts", () => ({ grantSkill: vi.fn() }));
vi.mock("./modalInput.ts", async (original) => ({
  ...(await original<typeof import("./modalInput.ts")>()),
  modalInput: () => ({
    accepts: () => true,
    capture: () => () => true,
    ready: vi.fn(),
    subscribe: () => {},
  }),
}));
vi.mock("./domUi.ts", () => ({
  artFrameUrl: vi.fn(async (_scene, art, frame) => `blob:${art}:${frame}`),
  mountSceneView: vi.fn((scene: RoomScene, root: HTMLElement) => {
    document.body.append(root);
    mountFixtureForeground(scene, "room", root);
  }),
  revealSceneView: vi.fn(),
  sceneDomUi: () => ({ element: document.createElement("div") }),
}));
vi.mock("./scenePalette.ts", () => ({ paletteColour: () => 0 }));

import { artFrameUrl, revealSceneView } from "./domUi.ts";
import { type RoomData, RoomScene } from "./RoomScene.ts";
import { grantSkill } from "./save.ts";

afterEach(() => {
  document.body.replaceChildren();
  vi.clearAllMocks();
});

function fixture(data: RoomData = { room: "dash-gift", stage: "street" }) {
  let resolve: (shown: boolean) => void = () => {};
  const revealed = new Promise<boolean>((done) => {
    resolve = done;
  });
  const cancel = vi.fn();
  vi.mocked(revealSceneView).mockImplementation((_scene, root) => {
    root.setAttribute("data-ui-unready", "");
    return { cancel, revealed };
  });
  const events = new EventEmitter();
  const controller = {
    isActive: () => true,
    launch: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    setVisible: vi.fn(),
    stop: vi.fn(),
  };
  const idle = sheetTags(pug as AsepriteSheet).get("idle")!;
  const portrait = { frame: { name: idle[0]!.frame }, height: 32, width: 44 };
  const room = new RoomScene();
  room.init(data);
  Object.assign(room, {
    cache: { json: { get: (key: string) => (key === "dog-pug" ? pug : dash) } },
    events,
    portrait,
    scene: controller,
  });
  const scene = room as unknown as { createDomView(): void; view: RoomView };
  scene.createDomView();
  return {
    cancel,
    controller,
    events,
    idle,
    portrait,
    resolve(shown: boolean) {
      if (shown && !cancel.mock.calls.length) {
        scene.view.root.removeAttribute("data-ui-unready");
      }
      resolve(shown);
    },
    room,
    scene,
  };
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

it("opens the destination conversation once and restores the same room and Talk focus", async () => {
  const destination = ZONE_MAP.destinations.find(({ id }) => id === "home-city")!;
  const { controller, resolve, room, scene } = fixture({
    room: "dash-gift",
    stage: destination.stages[0]!,
  });
  const originalView = scene.view;
  expect(grantSkill).toHaveBeenCalledExactlyOnceWith("dash");
  scene.view.talk!.click();
  expect(controller.launch).not.toHaveBeenCalled();
  resolve(true);
  await Promise.resolve();
  scene.view.talk!.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Tab" }));
  expect(document.activeElement).toBe(scene.view.talk);
  scene.view.talk!.dispatchEvent(
    new KeyboardEvent("keydown", { bubbles: true, key: "Enter", repeat: true }),
  );
  expect(controller.launch).not.toHaveBeenCalled();
  scene.view.talk!.click();
  scene.view.talk!.click();
  scene.view.leave.click();
  expect(controller.launch).toHaveBeenCalledExactlyOnceWith("dialogue", {
    linear: true,
    opener: "room",
    scene: GIFT_CONVERSATIONS[destination.id],
  });
  expect(controller.pause).toHaveBeenCalledOnce();
  expect(controller.stop).not.toHaveBeenCalled();
  room.dialogueClosed();
  room.dialogueClosed();
  expect(controller.resume).toHaveBeenCalledExactlyOnceWith();
  expect(scene.view).toBe(originalView);
  expect(document.activeElement).toBe(scene.view.talk);
  expect(grantSkill).toHaveBeenCalledOnce();
  scene.view.leave.click();
  expect(controller.resume).toHaveBeenLastCalledWith("zone");
  expect(controller.stop).toHaveBeenCalledOnce();
});

it.each([false, true])(
  "shows the lifetime only for the source-provided zone-scoped flag %s",
  (zoneScopedGift) => {
    const { scene } = fixture({ room: "dash-gift", stage: "street", zoneScopedGift });
    expect(scene.view.root.querySelector("#room-gift-lifetime")?.textContent).toBe(
      zoneScopedGift ? TEXT.room.giftLifetime : undefined,
    );
  },
);

it("does not resume a stopped room from a late conversation completion", async () => {
  const { controller, events, resolve, room, scene } = fixture();
  resolve(true);
  await Promise.resolve();
  scene.view.talk!.click();
  expect(controller.launch).toHaveBeenCalledOnce();
  events.emit("shutdown");
  room.dialogueClosed();
  expect(controller.resume).not.toHaveBeenCalled();
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
import { mountFixtureForeground } from "./foregroundFixture.ts";
