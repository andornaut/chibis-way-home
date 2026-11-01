import { EventEmitter } from "node:events";

import { expect, it, vi } from "vitest";

import { BARK_DURATION_SECONDS } from "../data/dialogues";
import { TOUCH } from "../data/touch";
import { DIALOGUE_SCREEN } from "../layout/dialogueScreen";

vi.mock("phaser", () => ({
  Scene: class {
    readonly add = { image: () => ({ destroy: vi.fn(), setOrigin: vi.fn().mockReturnThis() }) };
    readonly events = new EventEmitter();
    readonly game = { events: new EventEmitter() };
    readonly input = Object.assign(new EventEmitter(), { stopPropagation: vi.fn() });
    readonly scene = { key: "zoneBark", moveAbove: vi.fn() };
  },
}));
vi.mock("./dialogueParagraph", () => ({ drawDialogueParagraph: () => [] }));
vi.mock("./playCamera", () => ({
  fitPlayCamera: vi.fn(),
  playPoint: (_scene: unknown, point: unknown) => point,
}));
vi.mock("../dialogue/conversation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../dialogue/conversation")>()),
  dialogueParagraphs: vi.fn(() => [{}]),
}));

import { dialogueParagraphs } from "../dialogue/conversation";
import { createStageBarks } from "../rules/stageBarks";
import { modalInput } from "./modalInput";
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

const panelPointer = {
  id: 1,
  wasCanceled: false,
  x: DIALOGUE_SCREEN.box.x + 10,
  y: DIALOGUE_SCREEN.box.y + 10,
};

function showingBark() {
  const scene = new ZoneBarkScene();
  scene.init({ canPresent: () => true });
  scene.create();
  const images = vi.spyOn(scene.add, "image");
  scene.enqueue({ line: "first", speaker: "speaker" });
  scene.enqueue({ line: "second", speaker: "speaker" });
  scene.update(0, 0);
  return { images, scene };
}

it("dismisses only the tapped bark and retains the next queued line", () => {
  const { images, scene } = showingBark();
  const first = images.mock.results[0]!.value;
  scene.input.emit("pointerdown", panelPointer);
  scene.input.emit("pointerup", panelPointer);
  expect(first.destroy).toHaveBeenCalledOnce();
  expect(scene.idle()).toBe(false);
  scene.update(0, 0);
  expect(vi.mocked(dialogueParagraphs).mock.lastCall?.[2]).toEqual({
    lines: [{ line: "second", speaker: "speaker" }],
  });
  expect(images.mock.results[1]!.value.destroy).not.toHaveBeenCalled();
});

it.each(["drag", "cancel", "other pointer", "outside"])("does not dismiss on %s", (kind) => {
  const { images, scene } = showingBark();
  scene.input.emit("pointerdown", panelPointer);
  if (kind === "drag") {
    scene.input.emit("pointermove", {
      ...panelPointer,
      x: panelPointer.x + TOUCH.tapMaxDistance + 1,
    });
  }
  scene.input.emit(kind === "outside" ? "pointerupoutside" : "pointerup", {
    ...panelPointer,
    id: kind === "other pointer" ? 2 : panelPointer.id,
    wasCanceled: kind === "cancel",
  });
  expect(images.mock.results[0]!.value.destroy).not.toHaveBeenCalled();
});

it("rejects covered presses and releases captured before a modal changed", () => {
  const { images, scene } = showingBark();
  scene.input.emit("pointerdown", panelPointer);
  const cover = new ZoneBarkScene();
  cover.game = scene.game;
  modalInput(cover).open();
  scene.input.emit("pointerup", panelPointer);
  scene.input.emit("pointerdown", panelPointer);
  modalInput(cover).close();
  scene.input.emit("pointerup", panelPointer);
  expect(images.mock.results[0]!.value.destroy).not.toHaveBeenCalled();
  scene.input.emit("pointerdown", panelPointer);
  scene.input.emit("pointerup", panelPointer);
  expect(images.mock.results[0]!.value.destroy).toHaveBeenCalledOnce();
});

it("does not let a press on an expired bark dismiss its replacement", () => {
  const { images, scene } = showingBark();
  scene.input.emit("pointerdown", panelPointer);
  scene.update(0, BARK_DURATION_SECONDS * 1000);
  scene.input.emit("pointerup", panelPointer);
  expect(images.mock.results[0]!.value.destroy).toHaveBeenCalledOnce();
  expect(images.mock.results[1]!.value.destroy).not.toHaveBeenCalled();
});
