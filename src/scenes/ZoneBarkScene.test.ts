import { EventEmitter } from "node:events";

import { expect, it, vi } from "vitest";

import { BARK_DURATION_SECONDS } from "../data/dialogues";

vi.mock("phaser", () => ({
  Scene: class {
    readonly add = { image: () => ({ destroy: vi.fn(), setOrigin: vi.fn().mockReturnThis() }) };
    readonly events = new EventEmitter();
    readonly scene = { key: "zoneBark", moveAbove: vi.fn() };
  },
}));
vi.mock("./dialogueParagraph", () => ({ drawDialogueParagraph: () => [] }));
vi.mock("./playCamera", () => ({ fitPlayCamera: vi.fn() }));
vi.mock("../dialogue/conversation", () => ({ dialogueParagraphs: () => [{}] }));

import { ZoneBarkScene } from "./ZoneBarkScene";

it("keeps notices below modals, expires them during live play and clears retry queues", () => {
  const scene = new ZoneBarkScene();
  const images = vi.spyOn(scene.add, "image");
  scene.init();
  scene.create();
  expect(scene.scene.moveAbove).toHaveBeenCalledExactlyOnceWith("zone", "zoneBark");
  scene.enqueue({ line: "spotted", speaker: "speaker" });
  scene.update(0, 0);
  const image = images.mock.results[0]!.value;
  scene.update(BARK_DURATION_SECONDS * 1000 - 1, BARK_DURATION_SECONDS * 1000 - 1);
  expect(image.destroy).not.toHaveBeenCalled();
  scene.update(BARK_DURATION_SECONDS * 1000, 1);
  expect(image.destroy).toHaveBeenCalledOnce();
  scene.enqueue({ line: "spotted", speaker: "speaker" });
  scene.update(0, 0);
  const next = images.mock.results[1]!.value;
  scene.enqueue({ line: "queued", speaker: "speaker" });
  scene.reset();
  expect(next.destroy).toHaveBeenCalledOnce();
  scene.update(0, 0);
  expect(images).toHaveBeenCalledTimes(2);
});
