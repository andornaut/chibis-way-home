// @vitest-environment happy-dom
import { EventEmitter } from "node:events";

import { afterEach, beforeEach, expect, it, vi } from "vitest";

const turns = vi.hoisted(() => ({ change: () => {} }));
const selection = vi.hoisted(() => ({ select: vi.fn() }));
const dom = vi.hoisted(() => ({ layer: undefined as unknown }));
vi.mock("phaser", () => ({ Core: { Events: { POST_RENDER: "postrender" } }, Scene: class {} }));
vi.mock("../ui/input/frameTurn.ts", () => ({
  FRAME_TURN: {
    onChange: (listener: () => void) => {
      turns.change = listener;
      return () => {};
    },
  },
}));
vi.mock("../pwa/index.ts", () => ({
  PHONE_EVENTS: { backPressed: "phone-back" },
  coverZone: vi.fn(),
  startWakeLock: vi.fn(),
  stopWakeLock: vi.fn(),
  zoneShown: vi.fn(),
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
vi.mock("./domUi.ts", () => ({
  artFrameUrl: () => Promise.resolve("blob:glyph"),
  mountSceneView: (scene: { events: EventEmitter }, view: HTMLElement) => {
    const unmount = (dom.layer as UiLayer).mount(10, view);
    scene.events.once("shutdown", unmount);
    return unmount;
  },
  sceneDomUi: () => dom.layer,
}));

import { TEXT } from "../data/text.ts";
import { createUiLayer, type UiLayer } from "../ui/index.ts";
import { type DialogueChoiceData, DialogueChoiceScene } from "./DialogueChoiceScene.ts";
import { type DialogueData, DialogueScene } from "./DialogueScene.ts";
import { modalInput } from "./modalInput.ts";
import { createPauseScene, pressKey, settle, tap } from "./pauseFixture.ts";
import { ZoneDepartureScene } from "./ZoneDepartureScene.ts";

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

type Mode = "choice" | "departure" | "line";
const MODES: readonly Mode[] = ["line", "choice", "departure"];
// The scene each mode's conversation shows in, which the card pauses and resumes.
const HELD: Readonly<Record<Mode, string>> = {
  choice: "dialogueChoice",
  departure: "zoneDeparture",
  line: "dialogue",
};
const [PROMPT, FIRST, SECOND] = Object.keys(TEXT.lines);
const CHOICE = {
  options: [
    { id: "first", label: FIRST! },
    { id: "second", label: SECOND! },
  ],
  prompt: PROMPT!,
};

// A scene's Phaser input and keyboard, as the scene's watchers use them.
function sceneInput() {
  return Object.assign(new EventEmitter(), {
    keyboard: Object.assign(new EventEmitter(), { addCapture: vi.fn(), removeCapture: vi.fn() }),
    stopPropagation: vi.fn(),
  });
}

// The conversation over the paused zone, holding the real modal input gate: a line (the second,
// with Continue focused), its required choice (the second answer focused, the line paused under
// it), or the departure (Continue focused). Each watches its keys as in play; acted counts what
// would advance the line, select the answer or continue past the departure.
function shown(game: object, mode: Mode) {
  const input = sceneInput();
  const base = { events: new EventEmitter(), game, input };
  const dialogue = Object.assign(new DialogueScene() as object, base, {
    drawParagraph: vi.fn(),
  }) as unknown as {
    choosing: boolean;
    drawParagraph: ReturnType<typeof vi.fn>;
    focus: string | undefined;
    paragraph: number;
    init(data: DialogueData): void;
    watchInput(): void;
  };
  dialogue.init({ scene: "archie-intro" });
  dialogue.paragraph = 1;
  dialogue.focus = "continue";
  modalInput(dialogue as never).open();
  if (mode === "line") {
    dialogue.watchInput();
    return {
      acted: dialogue.drawParagraph,
      dialogue,
      input,
      scene: dialogue as object,
      state: () => ({ focus: dialogue.focus, paragraph: dialogue.paragraph }),
    };
  }
  if (mode === "choice") {
    dialogue.choosing = true;
    const choice = Object.assign(new DialogueChoiceScene() as object, base, {
      render: vi.fn(),
    }) as unknown as {
      buttons: Map<string, object>;
      focus: string | undefined;
      init(data: DialogueChoiceData): void;
      select(id: string): void;
      watchInput(): void;
    };
    choice.init({ choice: CHOICE });
    choice.buttons = new Map(CHOICE.options.map(({ id }) => [id, {}]));
    choice.focus = "second";
    modalInput(choice as never).open();
    choice.watchInput();
    return {
      acted: vi.spyOn(choice, "select").mockImplementation(() => {}),
      dialogue,
      input,
      scene: choice as object,
      state: () => ({ choosing: dialogue.choosing, focus: choice.focus }),
    };
  }
  const departure = Object.assign(new ZoneDepartureScene() as object, base, {
    render: vi.fn(),
  }) as unknown as {
    continue(): void;
    focused: boolean;
    watchKeys(): void;
  };
  modalInput(dialogue as never).close();
  departure.focused = true;
  departure.watchKeys();
  return {
    acted: vi.spyOn(departure, "continue").mockImplementation(() => {}),
    dialogue,
    input,
    scene: departure as object,
    state: () => ({ focused: departure.focused }),
  };
}

// The conversation and the pause scene beside it with no scope of its own, its presses, keys,
// back and frame turns watched as in play.
function conversation(mode: Mode = "line") {
  const game = { events: new EventEmitter() };
  const top = shown(game, mode);
  const zone = {
    conversationCovers: () => true,
    playCovered: () => true,
    showTouchControls: vi.fn(),
    skillState: () => undefined,
  };
  const scenes = {
    get: (key: string) => (key === "zone" ? zone : key === HELD[mode] ? top.scene : top.dialogue),
    isActive: (key: string) => key === HELD[mode],
    isPaused: (key: string) => key === "zone",
    key: "pause",
    launch: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    stop: vi.fn(),
  };
  const pause = createPauseScene(game, scenes);
  shutdowns.push(() => pause.events.emit("shutdown"));
  pause.update();
  // A key reaches the page, then, unless something stopped it, the conversation and the pause
  // scene, as Phaser hands it down the scenes.
  const key = (name: string) => pressKey([top.input.keyboard, pause.keyboard], name);
  const routes: Record<string, () => void> = {
    Escape: () => key("Escape"),
    P: () => key("P"),
    back: () => window.dispatchEvent(new Event("phone-back")),
    "frame turn": () => turns.change(),
    "pause button": () => tap(pause.pauseButton),
  };
  return { ...top, key, pause, routes, scenes };
}

const cardShown = (dialog: HTMLElement) => !dialog.closest<HTMLElement>(".ui-card-scene")!.hidden;

it.each(
  MODES.flatMap((mode) =>
    ["P", "Escape", "back", "frame turn", "pause button"].map((route) => ({ mode, route })),
  ),
)(
  "opens over the $mode by $route, keeping its state and focus, and resumes to it",
  async ({ mode, route }) => {
    const { acted, pause, routes, scene, scenes, state } = conversation(mode);
    const before = state();
    routes[route]!();
    await settle();
    expect(cardShown(pause.dialog)).toBe(true);
    expect(scenes.pause).toHaveBeenCalledExactlyOnceWith(HELD[mode]);
    expect(modalInput(scene as never).accepts()).toBe(false);
    pause.update();
    // Only the pause card hides the skill HUD over a conversation.
    expect([pause.skill("dash").hidden, pause.pauseButton.hidden]).toEqual([true, true]);
    tap(pause.button(TEXT.pause.resume));
    expect(cardShown(pause.dialog)).toBe(false);
    expect(scenes.resume).toHaveBeenCalledExactlyOnceWith(HELD[mode]);
    expect(state()).toEqual(before);
    expect(acted).not.toHaveBeenCalled();
    expect(modalInput(scene as never).accepts()).toBe(true);
  },
);

it.each(MODES.flatMap((mode) => ["p", "P", "Escape"].map((name) => ({ mode, name }))))(
  "passes $name on from the $mode to Pause without acting",
  ({ mode, name }) => {
    const { acted, key, state } = conversation(mode);
    const before = state();
    expect(key(name).stopped()).toBe(false);
    expect(acted).not.toHaveBeenCalled();
    expect(state()).toEqual(before);
  },
);

it("advances the conversation on another key, which Pause leaves alone", () => {
  const { dialogue, key, pause, scenes } = conversation();
  dialogue.paragraph = 0;
  expect(key("x").stopped()).toBe(true);
  expect(dialogue.paragraph).toBe(1);
  expect(dialogue.drawParagraph).toHaveBeenCalledOnce();
  expect(cardShown(pause.dialog)).toBe(false);
  expect(scenes.pause).not.toHaveBeenCalled();
});

it.each(["choice", "departure"] as const)(
  "acts on Enter in the %s, which Pause leaves alone",
  (mode) => {
    const { acted, key, pause, scenes } = conversation(mode);
    expect(key("Enter").stopped()).toBe(true);
    expect(acted).toHaveBeenCalledOnce();
    expect(cardShown(pause.dialog)).toBe(false);
    expect(scenes.pause).not.toHaveBeenCalled();
  },
);

it.each(MODES)(
  "shows the pause button and the skill HUD over the %s, the HUD taking no presses",
  (mode) => {
    const { acted, pause, scenes } = conversation(mode);
    expect({
      hud: !pause.skill("dash").hidden,
      live: pause.hud.hasAttribute("data-live"),
      pauseButton: !pause.pauseButton.hidden,
      tabIndex: [pause.pauseButton.tabIndex, pause.skill("dash").tabIndex],
    }).toEqual({ hud: true, live: false, pauseButton: true, tabIndex: [-1, -1] });
    tap(pause.skill("dash"));
    expect(selection.select).not.toHaveBeenCalled();
    expect(scenes.launch).not.toHaveBeenCalled();
    expect(acted).not.toHaveBeenCalled();
  },
);
