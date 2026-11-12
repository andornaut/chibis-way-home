// @vitest-environment happy-dom
import { EventEmitter } from "node:events";

import { afterEach, beforeEach, expect, it, vi } from "vitest";

const selection = vi.hoisted(() => ({ select: vi.fn() }));
const dom = vi.hoisted(() => ({ layer: undefined as unknown }));
vi.mock("phaser", () => ({ Core: { Events: { POST_RENDER: "postrender" } }, Scene: class {} }));
vi.mock("../ui/input/frameTurn", () => ({ FRAME_TURN: { onChange: () => () => {} } }));
vi.mock("../pwa", () => ({
  PHONE_EVENTS: { backPressed: "phone-back" },
  coverZone: vi.fn(),
  startWakeLock: vi.fn(),
  stopWakeLock: vi.fn(),
  zoneShown: vi.fn(),
}));
vi.mock("../ui/settings/touchControls", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../ui/settings/touchControls")>()),
  coarsePointer: () => true,
}));
vi.mock("../dev/mode", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../dev/mode")>()),
  developmentSkillOverrides: () => ({}),
}));
vi.mock("./save", () => ({
  activeSkill: () => "dash",
  savedSkills: () => ["dash"],
  selectActiveSkill: selection.select,
}));
vi.mock("./modalBackdrop", () => ({
  showModalBackdrop: () => ({ destroy: vi.fn(), ready: Promise.resolve(), setVisible: vi.fn() }),
}));
vi.mock("./domUi", () => ({
  artFrameUrl: () => Promise.resolve("blob:glyph"),
  mountSceneView: (scene: { events: EventEmitter }, view: HTMLElement) => {
    const unmount = (dom.layer as UiLayer).mount(10, view);
    scene.events.once("shutdown", unmount);
    return unmount;
  },
  sceneDomUi: () => dom.layer,
}));

import { ZONE_DIALOGUES } from "../data/dialogues";
import { ZONE_MAP } from "../data/map";
import { TEXT } from "../data/text";
import { createUiLayer, type UiLayer } from "../ui";
import { type DialogueData, DialogueScene } from "./DialogueScene";
import { createPauseScene, settle, tap } from "./pauseFixture";

let layer: UiLayer;
const shutdowns: (() => void)[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  layer = createUiLayer([], document);
  document.body.append(layer.element);
  dom.layer = layer;
});

afterEach(() => {
  shutdowns.splice(0).forEach((shutdown) => shutdown());
  layer.dispose();
});

interface DialogueState {
  focus: string | undefined;
  paragraph: number;
  drawParagraph(): void;
}

// The zone paused under a conversation, on its second line with Continue focused, and the pause
// scene beside it. Without a conversation (null) the zone is on the map: neither running nor
// paused.
function conversation(data: DialogueData | null = { scene: "archie-intro" }) {
  const game = { events: new EventEmitter() };
  const dialogue = Object.assign(new DialogueScene(), { events: new EventEmitter(), game });
  const lines = dialogue as unknown as DialogueState;
  if (data !== null) {
    dialogue.init(data);
    lines.paragraph = 1;
    lines.focus = "continue";
  }
  const drawParagraph = vi.spyOn(lines, "drawParagraph").mockImplementation(() => {});
  const zone = {
    conversationCovers: () => data !== null,
    playCovered: () => data !== null,
    showTouchControls: vi.fn(),
    skillState: () => undefined,
  };
  const scenes = {
    get: (key: string) => (key === "zone" ? zone : dialogue),
    isActive: (key: string) => key === "dialogue" && data !== null,
    isPaused: (key: string) => key === "zone" && data !== null,
    key: "pause",
    launch: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    stop: vi.fn(),
  };
  const pause = createPauseScene(game, scenes);
  shutdowns.push(() => pause.events.emit("shutdown"));
  pause.update();
  return { drawParagraph, lines, pause, scenes };
}

it("shows the pause button while a conversation covers play, and never on the map", () => {
  expect(conversation().pause.pauseButton.hidden).toBe(false);
  expect(conversation(null).pause.pauseButton.hidden).toBe(true);
});

const { id: zone, stages } = ZONE_MAP.destinations[0]!;

it.each<{ readonly data?: DialogueData; readonly name: string }>([
  { name: "a conversation" },
  {
    data: { clearedStage: stages.at(-1)!, scene: ZONE_DIALOGUES[zone]!.outro },
    name: "a zone's outgoing exchange",
  },
])("opens over $name and resumes it on the same line, the zone still paused", async ({ data }) => {
  const { drawParagraph, lines, pause, scenes } = conversation(data ?? { scene: "archie-intro" });
  tap(pause.pauseButton);
  await settle();
  const card = pause.dialog.closest<HTMLElement>(".ui-card-scene")!;
  expect(card.hidden).toBe(false);
  expect(scenes.pause).toHaveBeenCalledExactlyOnceWith("dialogue");
  tap(pause.button(TEXT.pause.resume));
  expect(card.hidden).toBe(true);
  expect(scenes.resume).toHaveBeenCalledExactlyOnceWith("dialogue");
  expect({ focus: lines.focus, paragraph: lines.paragraph }).toEqual({
    focus: "continue",
    paragraph: 1,
  });
  expect(drawParagraph).not.toHaveBeenCalled();
  pause.update();
  expect(pause.pauseButton.hidden).toBe(false);
});
