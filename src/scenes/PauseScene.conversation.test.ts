// @vitest-environment happy-dom
import { EventEmitter } from "node:events";

import { afterEach, beforeEach, expect, it, vi } from "vitest";

const selection = vi.hoisted(() => ({ select: vi.fn() }));
const dom = vi.hoisted(() => ({ layer: undefined as unknown }));
vi.mock("phaser", () => ({ Core: { Events: { POST_RENDER: "postrender" } }, Scene: class {} }));
vi.mock("../ui/input/frameTurn.ts", () => ({ FRAME_TURN: { onChange: () => () => {} } }));
vi.mock("../pwa/index.ts", () => ({
  PHONE_EVENTS: { backPressed: "phone-back" },
  startWakeLock: vi.fn(),
  stopWakeLock: vi.fn(),
}));
vi.mock("../ui/settings/touchControls.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../ui/settings/touchControls.ts")>()),
  coarsePointer: () => true,
}));
vi.mock("../dev/mode.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../dev/mode.ts")>()),
  developmentSkillOverrides: () => ({}),
}));
vi.mock("./save.ts", () => ({
  activeSkill: () => "dash",
  savedSkills: () => ["dash"],
  selectActiveSkill: selection.select,
}));
vi.mock("./modalBackdrop.ts", () => ({
  showModalBackdrop: () => ({ destroy: vi.fn(), ready: Promise.resolve(), setVisible: vi.fn() }),
}));
// Each view mounts at its scene's place in the game's scene list.
vi.mock("./domUi.ts", () => {
  const orders: Readonly<Record<string, number>> = { dialogue: 9, pause: 13 };
  return {
    artFrameUrl: () => Promise.resolve("blob:glyph"),
    mountSceneView: (
      scene: { events: EventEmitter; scene: { key: string } },
      view: HTMLElement,
    ) => {
      const unmount = (dom.layer as UiLayer).mount(orders[scene.scene.key] ?? 0, view);
      scene.events.once("shutdown", unmount);
      return unmount;
    },
    sceneDomUi: () => dom.layer,
  };
});

import { ZONE_DIALOGUES } from "../data/dialogues.ts";
import { ZONE_MAP } from "../data/map.ts";
import { createUiLayer, type UiLayer } from "../ui/index.ts";
import { type DialogueData, DialogueScene } from "./DialogueScene.ts";
import { modalInput } from "./modalInput.ts";
import { createPauseScene, settle, tap } from "./pauseFixture.ts";

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
  create(): void;
  paragraph: number;
  showParagraph(): void;
}

// The zone paused under a conversation, shown on its second line in its real modal (its input
// scope and dialog isolation in the UI layer), and the pause scene beside it. Without a
// conversation (null) the zone is on the map: neither running nor paused.
async function conversation(data: DialogueData | null = { scene: "archie-intro" }) {
  const game = { events: new EventEmitter() };
  const dialogue = Object.assign(new DialogueScene(), {
    events: new EventEmitter(),
    game,
    scene: {
      get: () => undefined,
      key: "dialogue",
      launch: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    },
    sys: { isActive: () => true },
    textures: { exists: () => true },
  });
  const lines = dialogue as unknown as DialogueState;
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
  if (data !== null) {
    dialogue.init(data);
    lines.paragraph = 1;
    shutdowns.push(() => dialogue.events.emit("shutdown"));
    lines.create();
    await settle();
  }
  const showParagraph = vi.spyOn(lines, "showParagraph").mockImplementation(() => {});
  pause.update();
  return { dialogue, lines, pause, scenes, showParagraph };
}

it("shows the pause button while a conversation covers play, and never on the map", async () => {
  const first = await conversation();
  expect(first.pause.pauseButton.hidden).toBe(false);
  shutdowns.splice(0).forEach((shutdown) => shutdown());
  expect((await conversation(null)).pause.pauseButton.hidden).toBe(true);
});

const { id: zone, stages } = ZONE_MAP.destinations[0]!;

it.each<{ readonly data?: DialogueData; readonly name: string }>([
  { name: "a conversation" },
  {
    data: { clearedStage: stages.at(-1)!, scene: ZONE_DIALOGUES[zone]!.outro },
    name: "a zone's outgoing exchange",
  },
])("leaves $name in its modal on the same line, the zone still paused", async ({ data }) => {
  const { dialogue, lines, pause, scenes, showParagraph } = await conversation(
    data ?? { scene: "archie-intro" },
  );
  expect(pause.pauseButton.closest("[inert]")).not.toBeNull();
  tap(pause.pauseButton);
  await settle();
  expect(pause.dialog.closest<HTMLElement>(".ui-card-scene")!.hidden).toBe(true);
  expect(scenes.pause).not.toHaveBeenCalled();
  expect(scenes.resume).not.toHaveBeenCalled();
  expect(modalInput(dialogue as never).accepts()).toBe(true);
  expect(lines.paragraph).toBe(1);
  expect(showParagraph).not.toHaveBeenCalled();
  pause.update();
  expect(pause.pauseButton.hidden).toBe(false);
});
