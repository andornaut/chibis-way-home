import { EventEmitter } from "node:events";

import { expect, it, onTestFinished, vi } from "vitest";

import { BARK_BACKGROUND_ALPHA, BARK_DURATION_SECONDS, SPEAKERS } from "../data/dialogues";
import { STAGE_BARKS } from "../data/stageBarks";
import { TEXT } from "../data/text";
import { TOUCH } from "../data/touch";
import type { DialogueLine } from "../data/types";
import { barkOwnerOnscreen } from "../presentation";
import { DIALOGUE_SCREEN, dialogueParagraphs } from "../ui";

vi.mock("phaser", () => ({
  Scene: class {
    readonly add = {
      image: () => ({
        destroy: vi.fn(),
        setAlpha: vi.fn().mockReturnThis(),
        setOrigin: vi.fn().mockReturnThis(),
      }),
    };
    readonly events = new EventEmitter();
    readonly game = { events: new EventEmitter() };
    readonly input = Object.assign(new EventEmitter(), { stopPropagation: vi.fn() });
    readonly scene = { key: "zoneBark", moveAbove: vi.fn() };
  },
  Scenes: { Events: { PRE_RENDER: "prerender" } },
}));
vi.mock("./dialogueParagraph", () => ({ drawDialogueParagraph: vi.fn(() => []) }));
vi.mock("./playCamera", () => ({
  fitPlayCamera: vi.fn(),
  playPoint: (_scene: unknown, point: unknown) => point,
}));
vi.mock("../ui/dialogue/conversation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../ui")>()),
  dialogueParagraphs: vi.fn(() => [{}]),
}));

import { createStageBarks } from "../rules/stageBarks";
import { drawDialogueParagraph } from "./dialogueParagraph";
import { modalInput } from "./modalInput";
import { ZoneBarkScene } from "./ZoneBarkScene";

const OWNER = { area: "main", attempt: 0, objectIndex: 0 };

it("keeps notices below modals, expires them during live play and clears retry queues", () => {
  const scene = new ZoneBarkScene();
  const images = vi.spyOn(scene.add, "image");
  scene.init({ canPresent: () => true, ownerVisible: () => true });
  scene.create();
  expect(scene.scene.moveAbove).toHaveBeenCalledExactlyOnceWith("zone", "zoneBark");
  scene.enqueue({ line: "spotted", speaker: "speaker" }, OWNER);
  scene.update(0, 0);
  const image = images.mock.results[0]!.value;
  scene.update(BARK_DURATION_SECONDS * 1000 - 1, BARK_DURATION_SECONDS * 1000 - 1);
  expect(image.destroy).not.toHaveBeenCalled();
  scene.update(BARK_DURATION_SECONDS * 1000, 1);
  expect(image.destroy).toHaveBeenCalledOnce();
  scene.enqueue({ line: "spotted", speaker: "speaker" }, OWNER);
  scene.update(0, 0);
  const next = images.mock.results[1]!.value;
  scene.enqueue({ line: "queued", speaker: "speaker" }, OWNER);
  scene.reset();
  expect(next.destroy).toHaveBeenCalledOnce();
  scene.update(0, 0);
  expect(images).toHaveBeenCalledTimes(2);
});

it("defers an offered story across a modal race and does not mark an unshown retry entry heard", () => {
  let allowed = true;
  const scene = new ZoneBarkScene();
  scene.init({ canPresent: () => allowed, ownerVisible: () => true });
  scene.create();
  const images = vi.spyOn(scene.add, "image");
  const line = { line: "story", speaker: "speaker" };
  const run = createStageBarks({ stage: [{ atProgress: 0.5, id: "story", line }] }, "stage");
  const offer = (onStart: () => void, entry: typeof line) => scene.offer(onStart, entry, OWNER);
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
  scene.init({ canPresent: () => allowed, ownerVisible: () => true });
  scene.create();
  const started = vi.fn();
  const story = { line: "story", speaker: "speaker" };
  const event = { line: "spotted", speaker: "speaker" };
  expect(scene.idle()).toBe(true);
  expect(scene.offer(started, story, OWNER)).toBe(true);
  const escaped = { line: "escaped", speaker: "speaker" };
  scene.enqueue(event, OWNER);
  scene.enqueue(escaped, OWNER);
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
  scene.init({ canPresent: () => true, ownerVisible: () => true });
  scene.create();
  const images = vi.spyOn(scene.add, "image");
  scene.enqueue({ line: "first", speaker: "speaker" }, OWNER);
  scene.enqueue({ line: "second", speaker: "speaker" }, OWNER);
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

it("retains offscreen entries, presents eligible owners and removes departed owners", () => {
  let allowed = true;
  const view = { height: 360, width: 720, x: 0, y: 0 };
  const hidden = { bounds: { height: 60, width: 48, x: 800, y: 20 }, rendered: true };
  const shown = { bounds: { height: 60, width: 48, x: 100, y: 20 }, rendered: true };
  const poses = new Map([
    [0, hidden],
    [1, shown],
  ]);
  const scene = new ZoneBarkScene();
  scene.init({
    canPresent: () => allowed,
    ownerVisible: (owner) =>
      barkOwnerOnscreen({ area: "main", attempt: 0, view }, (index) => poses.get(index), owner),
  });
  scene.create();
  const images = vi.spyOn(scene.add, "image");
  scene.enqueue({ line: "hidden", speaker: "speaker" }, OWNER);
  scene.enqueue({ line: "shown", speaker: "speaker" }, { ...OWNER, objectIndex: 1 });
  scene.update(0, 0);
  expect(vi.mocked(dialogueParagraphs).mock.lastCall?.[2]).toEqual({
    lines: [{ line: "shown", speaker: "speaker" }],
  });
  scene.update(0, BARK_DURATION_SECONDS * 1000);
  expect(images).toHaveBeenCalledOnce();
  expect(scene.idle()).toBe(false);
  hidden.bounds.x = 100;
  scene.update(0, 0);
  expect(vi.mocked(dialogueParagraphs).mock.lastCall?.[2]).toEqual({
    lines: [{ line: "hidden", speaker: "speaker" }],
  });
  allowed = false;
  hidden.bounds.x = 800;
  scene.events.emit("prerender");
  expect(images.mock.results[1]!.value.destroy).toHaveBeenCalledOnce();
  hidden.bounds.x = 100;
  allowed = true;
  scene.update(0, 0);
  expect(images).toHaveBeenCalledTimes(2);
  expect(scene.idle()).toBe(true);
});

it("marks a deferred scheduled line heard only when its actual owner can be presented", () => {
  const pose = { bounds: { height: 60, width: 48, x: 100, y: 20 }, rendered: true };
  const scene = new ZoneBarkScene();
  scene.init({
    canPresent: () => true,
    ownerVisible: (owner) =>
      barkOwnerOnscreen(
        { area: "main", attempt: 0, view: { height: 360, width: 720, x: 0, y: 0 } },
        () => pose,
        owner,
      ),
  });
  scene.create();
  const line = { line: "story", speaker: "speaker" };
  const run = createStageBarks({ stage: [{ atProgress: 0.5, id: "story", line }] }, "stage");
  const started = vi.fn();
  const offer = vi.fn((onStart: () => void, entry: typeof line) =>
    scene.offer(
      () => {
        started();
        onStart();
      },
      entry,
      OWNER,
    ),
  );
  expect(run.offer(offer, 0.5)).toBe(true);
  pose.bounds.x = 800;
  scene.update(0, BARK_DURATION_SECONDS * 2000);
  expect(started).not.toHaveBeenCalled();
  pose.bounds.x = 100;
  scene.update(0, 0);
  expect(started).toHaveBeenCalledOnce();
  expect(run.offer(offer, 0.5)).toBe(false);
  expect(offer).toHaveBeenCalledOnce();
});

it("shows an ownerless journey bark as Fert's offscreen voice and marks it heard", async () => {
  const { dialogueParagraphs: paragraphs } = await vi.importActual<
    typeof import("../ui/dialogue/conversation")
  >("../ui/dialogue/conversation");
  vi.mocked(dialogueParagraphs).mockImplementation(paragraphs);
  onTestFinished(() => {
    vi.mocked(dialogueParagraphs).mockReset();
  });
  const scene = new ZoneBarkScene();
  scene.init({ canPresent: () => true, ownerVisible: () => false });
  scene.create();
  const [stage] = Object.keys(STAGE_BARKS);
  const run = createStageBarks(STAGE_BARKS, stage!);
  const started = vi.fn();
  const offer = (onStart: () => void, line: DialogueLine) =>
    scene.offer(() => {
      started();
      onStart();
    }, line);
  expect(run.offer(offer, 1)).toBe(true);
  scene.update(0, 0);
  expect(started).toHaveBeenCalledOnce();
  expect(vi.mocked(drawDialogueParagraph).mock.lastCall?.[1]).toMatchObject({
    name: TEXT.dialogue.speakers.ferret,
    portrait: SPEAKERS.ferret!.portrait,
  });
  scene.events.emit("prerender");
  expect(scene.idle()).toBe(false);
  scene.update(0, BARK_DURATION_SECONDS * 1000);
  expect(scene.idle()).toBe(true);
});

it("applies live background opacity without changing portrait or text opacity", () => {
  const portrait = { destroy: vi.fn(), setAlpha: vi.fn() };
  const text = { destroy: vi.fn(), setAlpha: vi.fn() };
  vi.mocked(drawDialogueParagraph).mockReturnValueOnce([portrait, text] as unknown as ReturnType<
    typeof drawDialogueParagraph
  >);
  const { images } = showingBark();
  expect(images.mock.results[0]!.value.setAlpha).toHaveBeenCalledExactlyOnceWith(
    BARK_BACKGROUND_ALPHA,
  );
  expect(portrait.setAlpha).not.toHaveBeenCalled();
  expect(text.setAlpha).not.toHaveBeenCalled();
});
