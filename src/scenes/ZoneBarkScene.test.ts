// @vitest-environment happy-dom
import { EventEmitter } from "node:events";

import { afterEach, beforeEach, expect, it, onTestFinished, vi } from "vitest";

import { BARK_DURATION_SECONDS, SPEAKERS } from "../data/dialogues.ts";
import { STAGE_BARKS } from "../data/stageBarks.ts";
import { TEXT } from "../data/text.ts";
import { TOUCH } from "../data/touch.ts";
import type { DialogueLine, DialoguePlan, Rect } from "../data/types/index.ts";
import { barkOwnerOnscreen } from "../presentation/index.ts";
import { DIALOGUE_SCREEN, dialogueNameTab, dialogueParagraphs } from "../ui/index.ts";

const portraits = vi.hoisted(() => ({ cut: vi.fn((_scene: unknown, art: string) => art) }));
vi.mock("phaser", () => ({ Scene: class {}, Scenes: { Events: { PRE_RENDER: "prerender" } } }));
vi.mock("./domUi.ts", () => ({
  artFrameUrl: (scene: unknown, art: string) =>
    Promise.resolve(`blob:${portraits.cut(scene, art)}`),
  mountSceneView: (scene: { events: EventEmitter }, view: HTMLElement) => {
    document.body.append(view);
    scene.events.once("shutdown", () => view.remove());
    return () => view.remove();
  },
}));
// Each bark shows its line key as its text, from a left speaker with a name tab.
vi.mock("../ui/dialogue/conversation.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../ui/index.ts")>()),
  dialogueParagraphs: vi.fn((_speakers: unknown, _text: unknown, plan: DialoguePlan) => [
    {
      colour: "tan",
      name: "Speaker",
      portrait: "portrait",
      side: "left",
      text: plan.lines[0]!.line,
    },
  ]),
}));

import { createStageBarks } from "../rules/stageBarks.ts";
import { modalInput } from "./modalInput.ts";
import { ZoneBarkScene } from "./ZoneBarkScene.ts";

const OWNER = { area: "main", attempt: 0, objectIndex: 0 };
const { box } = DIALOGUE_SCREEN;
const TAB = dialogueNameTab("left", 40);
const scenes: ZoneBarkScene[] = [];

// happy-dom lays nothing out, so the panel and its tab sit at their base-view places, one CSS px
// per base px.
beforeEach(() => {
  const rect = ({ height, width, x, y }: Rect) => new DOMRect(x, y, width, height);
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    if (this.classList.contains("dialogue-panel")) {
      return rect(box);
    }
    return this.classList.contains("dialogue-name-tab") ? rect(TAB) : new DOMRect();
  });
});

afterEach(() => {
  scenes.splice(0).forEach((scene) => scene.events.emit("shutdown"));
  vi.restoreAllMocks();
});

function barks(context: Parameters<ZoneBarkScene["init"]>[0]) {
  const game = { events: new EventEmitter() };
  const scene = Object.assign(new ZoneBarkScene(), {
    events: new EventEmitter(),
    game,
    scene: { key: "zoneBark", moveAbove: vi.fn() },
  });
  scenes.push(scene);
  scene.init(context);
  scene.create();
  return scene;
}

// The bark the panel shows, or undefined while it shows none.
function shownText(): string | null | undefined {
  const panel = document.querySelector<HTMLElement>(".dialogue-panel")!;
  return panel.hidden ? undefined : panel.querySelector(".dialogue-line")!.textContent;
}

function pointer(type: string, at: { readonly x: number; readonly y: number }, pointerId = 1) {
  document.body.dispatchEvent(
    new PointerEvent(type, { bubbles: true, clientX: at.x, clientY: at.y, pointerId }),
  );
}

const onPanel = { x: box.x + 10, y: box.y + 10 };

function tap(at = onPanel) {
  pointer("pointerdown", at);
  pointer("pointerup", at);
}

it("keeps notices below modals, expires them during live play and clears retry queues", () => {
  const scene = barks({ canPresent: () => true, ownerVisible: () => true });
  expect(scene.scene.moveAbove).toHaveBeenCalledExactlyOnceWith("zone", "zoneBark");
  scene.enqueue({ line: "spotted", speaker: "speaker" }, OWNER);
  scene.update(0, 0);
  expect(shownText()).toBe("spotted");
  scene.update(0, BARK_DURATION_SECONDS * 1000 - 1);
  expect(shownText()).toBe("spotted");
  scene.update(0, 1);
  expect(shownText()).toBeUndefined();
  scene.enqueue({ line: "spotted", speaker: "speaker" }, OWNER);
  scene.update(0, 0);
  scene.enqueue({ line: "queued", speaker: "speaker" }, OWNER);
  scene.reset();
  expect(shownText()).toBeUndefined();
  scene.update(0, 0);
  expect(shownText()).toBeUndefined();
});

it("defers an offered story across a modal race and does not mark an unshown retry entry heard", () => {
  let allowed = true;
  const scene = barks({ canPresent: () => allowed, ownerVisible: () => true });
  const line = { line: "story", speaker: "speaker" };
  const run = createStageBarks({ stage: [{ atProgress: 0.5, id: "story", line }] }, "stage");
  const offer = (onStart: () => void, entry: typeof line) => scene.offer(onStart, entry, OWNER);
  expect(run.offer(offer, 0.5)).toBe(true);
  allowed = false;
  scene.update(0, 10000);
  expect(shownText()).toBeUndefined();
  scene.reset();
  allowed = true;
  expect(run.offer(offer, 0)).toBe(false);
  expect(run.offer(offer, 0.5)).toBe(true);
  scene.update(0, 0);
  expect(shownText()).toBe("story");
  expect(run.offer(offer, 0.5)).toBe(false);
});

it("keeps engine notice order ahead of an unshown story and freezes active duration under cover", () => {
  let allowed = true;
  const scene = barks({ canPresent: () => allowed, ownerVisible: () => true });
  const started = vi.fn();
  expect(scene.idle()).toBe(true);
  expect(scene.offer(started, { line: "story", speaker: "speaker" }, OWNER)).toBe(true);
  scene.enqueue({ line: "spotted", speaker: "speaker" }, OWNER);
  scene.enqueue({ line: "escaped", speaker: "speaker" }, OWNER);
  scene.update(0, 0);
  expect(shownText()).toBe("spotted");
  allowed = false;
  scene.update(0, BARK_DURATION_SECONDS * 2000);
  expect(shownText()).toBe("spotted");
  allowed = true;
  scene.update(0, BARK_DURATION_SECONDS * 1000);
  expect([shownText(), started.mock.calls.length]).toEqual(["escaped", 0]);
  scene.update(0, BARK_DURATION_SECONDS * 1000);
  expect([shownText(), started.mock.calls.length]).toEqual(["story", 1]);
  expect(scene.idle()).toBe(false);
});

function showingBark() {
  const scene = barks({ canPresent: () => true, ownerVisible: () => true });
  scene.enqueue({ line: "first", speaker: "speaker" }, OWNER);
  scene.enqueue({ line: "second", speaker: "speaker" }, OWNER);
  scene.update(0, 0);
  return scene;
}

it("dismisses only the tapped bark and retains the next queued line", () => {
  const scene = showingBark();
  tap();
  expect(shownText()).toBeUndefined();
  expect(scene.idle()).toBe(false);
  scene.update(0, 0);
  expect(shownText()).toBe("second");
});

it.each([
  ["name tab", true],
  ["strip beside the tab", false],
] as const)("a tap on the %s dismisses the bark: %s", (_where, dismissed) => {
  showingBark();
  tap({ x: dismissed ? TAB.x + 1 : TAB.x - 1, y: TAB.y + 1 });
  expect(shownText()).toBe(dismissed ? undefined : "first");
});

it.each(["drag", "cancel", "other pointer", "lift off the panel"])(
  "does not dismiss on a %s",
  (kind) => {
    showingBark();
    pointer("pointerdown", onPanel);
    if (kind === "drag") {
      pointer("pointermove", { ...onPanel, x: onPanel.x + TOUCH.tapMaxDistance + 1 });
    }
    const at = kind === "lift off the panel" ? { x: 10, y: 300 } : onPanel;
    pointer(
      kind === "cancel" ? "pointercancel" : "pointerup",
      at,
      kind === "other pointer" ? 2 : 1,
    );
    expect(shownText()).toBe("first");
  },
);

it("rejects covered presses and releases captured before a modal changed", () => {
  const scene = showingBark();
  pointer("pointerdown", onPanel);
  const cover = Object.assign(new ZoneBarkScene(), {
    events: new EventEmitter(),
    game: scene.game,
  });
  modalInput(cover).open();
  pointer("pointerup", onPanel);
  pointer("pointerdown", onPanel);
  modalInput(cover).close();
  pointer("pointerup", onPanel);
  expect(shownText()).toBe("first");
  tap();
  expect(shownText()).toBeUndefined();
});

it("does not let a press on an expired bark dismiss its replacement", () => {
  const scene = showingBark();
  pointer("pointerdown", onPanel);
  scene.update(0, BARK_DURATION_SECONDS * 1000);
  expect(shownText()).toBe("second");
  pointer("pointerup", onPanel);
  expect(shownText()).toBe("second");
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
  const scene = barks({
    canPresent: () => allowed,
    ownerVisible: (owner) =>
      barkOwnerOnscreen({ area: "main", attempt: 0, view }, (index) => poses.get(index), owner),
  });
  scene.enqueue({ line: "hidden", speaker: "speaker" }, OWNER);
  scene.enqueue({ line: "shown", speaker: "speaker" }, { ...OWNER, objectIndex: 1 });
  scene.update(0, 0);
  expect(shownText()).toBe("shown");
  scene.update(0, BARK_DURATION_SECONDS * 1000);
  expect(shownText()).toBeUndefined();
  expect(scene.idle()).toBe(false);
  hidden.bounds.x = 100;
  scene.update(0, 0);
  expect(shownText()).toBe("hidden");
  allowed = false;
  hidden.bounds.x = 800;
  scene.events.emit("prerender");
  expect(shownText()).toBeUndefined();
  hidden.bounds.x = 100;
  allowed = true;
  scene.update(0, 0);
  expect(shownText()).toBeUndefined();
  expect(scene.idle()).toBe(true);
});

it("marks a deferred scheduled line heard only when its actual owner can be presented", () => {
  const pose = { bounds: { height: 60, width: 48, x: 100, y: 20 }, rendered: true };
  const scene = barks({
    canPresent: () => true,
    ownerVisible: (owner) =>
      barkOwnerOnscreen(
        { area: "main", attempt: 0, view: { height: 360, width: 720, x: 0, y: 0 } },
        () => pose,
        owner,
      ),
  });
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

it("shows an ownerless journey bark as Fert's offscreen voice, with his portrait, and marks it heard", async () => {
  const { dialogueParagraphs: paragraphs } = await vi.importActual<
    typeof import("../ui/dialogue/conversation.ts")
  >("../ui/dialogue/conversation.ts");
  vi.mocked(dialogueParagraphs).mockImplementation(paragraphs);
  onTestFinished(() => {
    vi.mocked(dialogueParagraphs).mockReset();
  });
  const scene = barks({ canPresent: () => true, ownerVisible: () => false });
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
  await Promise.resolve();
  expect(started).toHaveBeenCalledOnce();
  const tab = document.querySelector(".dialogue-name-tab")!;
  const portrait = document.querySelector<HTMLImageElement>(".dialogue-portrait")!;
  expect({
    name: tab.textContent,
    portrait: [portrait.hidden, portrait.getAttribute("src")],
    status: document.querySelector("[role=status]")?.contains(tab),
  }).toEqual({
    name: TEXT.dialogue.speakers.ferret,
    portrait: [false, `blob:${SPEAKERS.ferret!.portrait}`],
    status: true,
  });
  scene.events.emit("prerender");
  expect(scene.idle()).toBe(false);
  scene.update(0, BARK_DURATION_SECONDS * 1000);
  expect(scene.idle()).toBe(true);
});
