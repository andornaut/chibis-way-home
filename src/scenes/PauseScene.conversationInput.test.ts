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
// Each view mounts at its scene's place in the game's scene list.
vi.mock("./domUi.ts", () => {
  const orders: Readonly<Record<string, number>> = {
    dialogue: 9,
    dialogueChoice: 11,
    pause: 13,
    zoneDeparture: 12,
  };
  const layer = () => dom.layer as UiLayer;
  return {
    artFrameUrl: () => Promise.resolve("blob:glyph"),
    conversationControls: () => [...layer().element.querySelectorAll<HTMLElement>(".pause-button")],
    mountSceneView: (
      scene: { events: EventEmitter; scene: { key: string } },
      view: HTMLElement,
    ) => {
      const unmount = layer().mount(orders[scene.scene.key] ?? 0, view);
      scene.events.once("shutdown", unmount);
      return unmount;
    },
    sceneDomUi: () => dom.layer,
  };
});

import { ZONE_MAP } from "../data/map.ts";
import { TEXT } from "../data/text.ts";
import { createUiLayer, type UiLayer } from "../ui/index.ts";
import { type DialogueChoiceData, DialogueChoiceScene } from "./DialogueChoiceScene.ts";
import { type DialogueData, DialogueScene } from "./DialogueScene.ts";
import { modalInput } from "./modalInput.ts";
import { createPauseScene, pressKey, settle, tap } from "./pauseFixture.ts";
import { type ZoneDepartureData, ZoneDepartureScene } from "./ZoneDepartureScene.ts";

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
const DEPARTURE: ZoneDepartureData = {
  cleared: true,
  clearedStage: ZONE_MAP.destinations[0]!.stages.at(-1)!,
  percent: 1,
  runStats: { attemptSeconds: 1, attempts: 1, bestSeconds: 1, runSeconds: 1 },
  stage: ZONE_MAP.destinations[0]!.stages.at(-1)!,
  wholeRun: { activeSeconds: 1, completed: 1, deaths: 0, total: 21 },
  zoneStats: {
    attemptSeconds: 1,
    attempts: 1,
    bestSeconds: 1,
    completed: 1,
    partial: false,
    runSeconds: 1,
    total: 3,
  },
};

// The conversation's scene, over the paused zone, created against stand-ins for Phaser's parts.
function sceneParts(game: object, key: string, get: () => unknown) {
  return {
    events: new EventEmitter(),
    game,
    scene: { get, key, launch: vi.fn(), pause: vi.fn(), start: vi.fn(), stop: vi.fn() },
    sys: { isActive: () => true },
    textures: { exists: () => true },
  };
}

const control = (selector: string) => document.querySelector<HTMLButtonElement>(selector)!;
const focusText = () => document.activeElement?.textContent;

// The conversation over the paused zone, holding the real modal input gate: a line (the second,
// with Continue focused), its required choice (the second answer focused, the line paused under
// it), or the departure (Continue focused), each in the UI layer over the pause scene's view.
// acted counts what would advance the line, select the answer or continue past the departure.
async function shown(game: object, mode: Mode) {
  const dialogue = new DialogueScene() as unknown as {
    choosing: boolean;
    paragraph: number;
    create(): void;
    events: EventEmitter;
    init(data: DialogueData): void;
    showParagraph(): void;
  };
  Object.assign(
    dialogue,
    sceneParts(game, "dialogue", () => undefined),
  );
  dialogue.init({ scene: "archie-intro" });
  shutdowns.push(() => dialogue.events.emit("shutdown"));
  if (mode === "line") {
    dialogue.paragraph = 1;
    dialogue.create();
    modalInput(dialogue as never).open();
    control(".dialogue-footer [data-control=continue]").focus();
    return {
      acted: vi.spyOn(dialogue, "showParagraph").mockImplementation(() => {}),
      dialogue,
      scene: dialogue as object,
      state: () => ({ focus: focusText(), paragraph: dialogue.paragraph }),
    };
  }
  if (mode === "choice") {
    dialogue.choosing = true;
    const choice = new DialogueChoiceScene() as unknown as {
      create(): void;
      events: EventEmitter;
      init(data: DialogueChoiceData): void;
      select(id: string): void;
    };
    Object.assign(
      choice,
      sceneParts(game, "dialogueChoice", () => dialogue),
    );
    choice.init({ choice: CHOICE });
    shutdowns.push(() => choice.events.emit("shutdown"));
    choice.create();
    modalInput(choice as never).open();
    await settle();
    control(".dialogue-choice [data-answer=second]").focus();
    return {
      acted: vi.spyOn(choice, "select").mockImplementation(() => {}),
      dialogue,
      scene: choice as object,
      state: () => ({ choosing: dialogue.choosing, focus: focusText() }),
    };
  }
  const departure = new ZoneDepartureScene() as unknown as {
    continue(): void;
    create(): void;
    events: EventEmitter;
    init(data: ZoneDepartureData): void;
  };
  Object.assign(
    departure,
    sceneParts(game, "zoneDeparture", () => undefined),
  );
  departure.init(DEPARTURE);
  shutdowns.push(() => departure.events.emit("shutdown"));
  departure.create();
  control(".stage-summary-footer .ui-text-button").focus();
  return {
    acted: vi.spyOn(departure, "continue").mockImplementation(() => {}),
    dialogue,
    scene: departure as object,
    state: () => ({ focus: focusText() }),
  };
}

// The pause scene with no scope of its own, its presses, keys, back and frame turns watched as in
// play, and the conversation beside it.
async function conversation(mode: Mode = "line") {
  const game = { events: new EventEmitter() };
  const holder: { top?: Awaited<ReturnType<typeof shown>> } = {};
  const zone = {
    conversationCovers: () => true,
    playCovered: () => true,
    showTouchControls: vi.fn(),
    skillState: () => undefined,
  };
  const scenes = {
    get: (key: string) =>
      key === "zone" ? zone : key === HELD[mode] ? holder.top!.scene : holder.top!.dialogue,
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
  const top = await shown(game, mode);
  holder.top = top;
  pause.update();
  // A key reaches the page, then, unless something stopped it, the pause scene's Phaser keyboard.
  const key = (name: string) => pressKey([pause.keyboard], name);
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
    const { acted, pause, routes, scene, scenes, state } = await conversation(mode);
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
  async ({ mode, name }) => {
    const { acted, key, state } = await conversation(mode);
    const before = state();
    expect(key(name).stopped()).toBe(false);
    expect(acted).not.toHaveBeenCalled();
    expect(state()).toEqual(before);
  },
);

it("advances the conversation on another key, which Pause leaves alone", async () => {
  const { acted, dialogue, key, pause, scenes } = await conversation();
  dialogue.paragraph = 0;
  expect(key("x").stopped()).toBe(true);
  expect(dialogue.paragraph).toBe(1);
  expect(acted).toHaveBeenCalledOnce();
  expect(cardShown(pause.dialog)).toBe(false);
  expect(scenes.pause).not.toHaveBeenCalled();
});

it.each(["choice", "departure"] as const)(
  "acts on Enter in the %s, which Pause leaves alone",
  async (mode) => {
    const { acted, key, pause, scenes } = await conversation(mode);
    expect(key("Enter").stopped()).toBe(true);
    expect(acted).toHaveBeenCalledOnce();
    expect(cardShown(pause.dialog)).toBe(false);
    expect(scenes.pause).not.toHaveBeenCalled();
  },
);

it.each(MODES)(
  "shows the pause button and the skill HUD over the %s, the HUD taking no presses",
  async (mode) => {
    const { acted, pause, scenes } = await conversation(mode);
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
