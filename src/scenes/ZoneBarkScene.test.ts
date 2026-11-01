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
vi.mock("../dialogue/conversation", () => ({ dialogueParagraphs: vi.fn(() => [{}]) }));

import { dialogueParagraphs } from "../dialogue/conversation";
import { createStageBarks } from "../rules/stageBarks";
import { ZoneBarkScene } from "./ZoneBarkScene";

it("keeps notices below modals, expires them during live play and clears retry queues", () => {
  const scene = new ZoneBarkScene();
  const images = vi.spyOn(scene.add, "image");
  scene.init({ canPresent: () => true });
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

it("defers an offered story across a modal race and does not mark an unshown retry entry heard", () => {
  let allowed = true;
  const scene = new ZoneBarkScene();
  scene.init({ canPresent: () => allowed });
  scene.create();
  const images = vi.spyOn(scene.add, "image");
  const line = { line: "story", speaker: "speaker" };
  const run = createStageBarks({ stage: [{ atProgress: 0.5, id: "story", line }] }, "stage");
  const offer = (onStart: () => void, entry: typeof line) => scene.offer(onStart, entry);
  expect(run.offer(offer, 0.5)).toBe(true);
  allowed = false;
  scene.update(0, 10000);
  expect(images).not.toHaveBeenCalled();
  scene.reset();
  allowed = true;
  expect(run.offer(offer, 0)).toBe(false);
  expect(run.offer(offer, 0.5)).toBe(true);
  scene.update(0, 0);
  expect(images).toHaveBeenCalledOnce();
  expect(run.offer(offer, 0.5)).toBe(false);
});
it("keeps engine notice order ahead of an unshown story and freezes active duration under cover", () => {
  let allowed = true;
  const scene = new ZoneBarkScene();
  scene.init({ canPresent: () => allowed });
  scene.create();
  const started = vi.fn();
  const story = { line: "story", speaker: "speaker" };
  const event = { line: "spotted", speaker: "speaker" };
  expect(scene.idle()).toBe(true);
  expect(scene.offer(started, story)).toBe(true);
  const escaped = { line: "escaped", speaker: "speaker" };
  scene.enqueue(event);
  scene.enqueue(escaped);
  scene.update(0, 0);
  expect(vi.mocked(dialogueParagraphs).mock.lastCall?.[2]).toEqual({ lines: [event] });
  expect(started).not.toHaveBeenCalled();
  allowed = false;
  scene.update(0, BARK_DURATION_SECONDS * 2000);
  expect(started).not.toHaveBeenCalled();
  allowed = true;
  scene.update(0, BARK_DURATION_SECONDS * 1000);
  expect(started).not.toHaveBeenCalled();
  expect(vi.mocked(dialogueParagraphs).mock.lastCall?.[2]).toEqual({ lines: [escaped] });
  scene.update(0, BARK_DURATION_SECONDS * 1000);
  expect(started).toHaveBeenCalledOnce();
  expect(vi.mocked(dialogueParagraphs).mock.lastCall?.[2]).toEqual({ lines: [story] });
  expect(scene.idle()).toBe(false);
});
