import { afterEach, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({ Input: {}, Scale: {}, Scene: class {}, Scenes: {} }));
vi.mock("../save", () => ({ grantSkill: vi.fn() }));
vi.mock("../data/rooms", () => ({ ROOMS: { gift: { grant: "dash" }, ordinary: {} } }));

import { grantSkill } from "../save";
import { RoomScene } from "./RoomScene";

afterEach(() => vi.clearAllMocks());

it("grants the configured room reward on entry without granting anything for an ordinary room", () => {
  const scene = new RoomScene();
  scene.init({ room: "ordinary" });
  expect(grantSkill).not.toHaveBeenCalled();
  scene.init({ room: "gift" });
  expect(grantSkill).toHaveBeenCalledExactlyOnceWith("dash");
});
