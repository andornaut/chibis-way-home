import { afterEach, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({ Input: {}, Scale: {}, Scene: class {}, Scenes: {} }));
vi.mock("./save.ts", () => ({ grantSkill: vi.fn() }));
vi.mock("../data/rooms.ts", () => ({ ROOMS: { gift: { grant: "dash" }, ordinary: {} } }));

import type { RoomEvent } from "../ui/index.ts";
import { RoomScene } from "./RoomScene.ts";
import { grantSkill } from "./save.ts";

afterEach(() => vi.clearAllMocks());

it("grants the configured room reward on entry without granting anything for an ordinary room", () => {
  const scene = new RoomScene();
  scene.init({ room: "ordinary", stage: "street" });
  expect(grantSkill).not.toHaveBeenCalled();
  scene.init({ room: "gift", stage: "street" });
  expect(grantSkill).toHaveBeenCalledExactlyOnceWith("dash");
});

it.each(["gift", "ordinary"])(
  "preserves one guarded return from the %s room to the zone",
  (room) => {
    const controller = { resume: vi.fn(), setVisible: vi.fn(), stop: vi.fn() };
    const scene = Object.assign(new RoomScene(), { scene: controller }) as unknown as {
      act(event: RoomEvent): void;
      init(data: { room: string; stage: string }): void;
    };
    scene.init({ room, stage: "street" });
    scene.act({ down: undefined, kind: "press", up: "leave" });
    expect(controller.resume).not.toHaveBeenCalled();
    scene.act({ down: "leave", kind: "press", up: "leave" });
    scene.act({ down: "leave", kind: "press", up: "leave" });
    expect(controller.setVisible).toHaveBeenCalledExactlyOnceWith(true, "zone");
    expect(controller.resume).toHaveBeenCalledExactlyOnceWith("zone");
    expect(controller.stop).toHaveBeenCalledOnce();
  },
);
