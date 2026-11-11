import { EventEmitter } from "node:events";

import { afterEach, beforeEach, expect, it, vi } from "vitest";

const turns = vi.hoisted(() => ({ change: () => {} }));
vi.mock("phaser", () => ({ Scene: class {} }));
vi.mock("../ui/input/frameTurn", () => ({
  FRAME_TURN: {
    onChange: (listener: () => void) => {
      turns.change = listener;
      return () => {};
    },
  },
}));
vi.mock("../pwa", () => ({
  PHONE_EVENTS: { backPressed: "phone-back" },
  coverZone: vi.fn(),
  startWakeLock: vi.fn(),
  stopWakeLock: vi.fn(),
}));
vi.mock("../ui/settings/touchControls", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../ui/settings/touchControls")>()),
  coarsePointer: () => true,
}));
vi.mock("./save", () => ({
  activeSkill: () => "dash",
  savedSkills: () => ["dash"],
  selectActiveSkill: vi.fn(),
}));

import { TEXT } from "../data/text";
import { PAUSE_BUTTON, SKILL_BUTTON, skillHud } from "../ui";
import { type DialogueChoiceData, DialogueChoiceScene } from "./DialogueChoiceScene";
import { type DialogueData, DialogueScene } from "./DialogueScene";
import { modalInput } from "./modalInput";
import { PauseScene } from "./PauseScene";
import { ZoneDepartureScene } from "./ZoneDepartureScene";

beforeEach(() => vi.stubGlobal("window", new EventTarget()));
afterEach(() => vi.unstubAllGlobals());

interface PauseState {
  hud: Map<string, { visible: ReturnType<typeof vi.fn> }>;
  pauseButton: { setVisible: ReturnType<typeof vi.fn>; visible: boolean };
  state: string;
  controlAt(pointer: { readonly x: number; readonly y: number }): string | undefined;
  press(control: string): void;
  showPauseButton(): void;
  showSkillHud(): void;
  skillHudLive(): boolean;
}

function keyEvent(key: string) {
  return { key, repeat: false, shiftKey: false, stopPropagation: vi.fn() };
}

function icon() {
  return { place: vi.fn(), ready: vi.fn(), selected: vi.fn(), visible: vi.fn() };
}

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
    pause: vi.fn(),
    resume: vi.fn(),
  };
  const input = sceneInput();
  const pause = Object.assign(new PauseScene(), {
    cameras: { main: { x: 0, y: 0, zoom: 1 } },
    card: { destroy: vi.fn() },
    dimZone: vi.fn(async () => {}),
    dims: new Map(),
    enabledSkills: () => ["dash"],
    events: new EventEmitter(),
    game,
    hud: new Map([["dash", icon()]]),
    input,
    layout: { close: {} },
    pauseButton: { setVisible: vi.fn(), visible: true },
    redrawCard: vi.fn(),
    renderDim: vi.fn(),
    scale: { gameSize: { height: 360, width: 720 }, zoom: 1 },
    scene: scenes,
    setPressed(this: { pressed: string | undefined }, value: string | undefined) {
      this.pressed = value;
    },
    showCard: vi.fn(),
    sys: { isActive: () => true },
    time: { now: 0 },
  });
  const watched = pause as unknown as {
    watchBackAndTurns(): void;
    watchKeys(): void;
    watchPresses(): void;
  };
  watched.watchPresses();
  watched.watchKeys();
  watched.watchBackAndTurns();
  const press = vi.spyOn(pause as unknown as PauseState, "press");
  // A key reaches the conversation, then the pause scene, as Phaser hands it down the scenes.
  const key = (name: string) => {
    const event = keyEvent(name);
    top.input.keyboard.emit("keydown", event);
    input.keyboard.emit("keydown", event);
    return event;
  };
  const tap = (at: { readonly x: number; readonly y: number }) => {
    const pointer = { id: 1, wasCanceled: false, ...at };
    input.emit("pointerdown", pointer);
    input.emit("pointerup", pointer);
  };
  const tapPauseButton = () =>
    tap({
      x: PAUSE_BUTTON.art.x + PAUSE_BUTTON.art.width / 2,
      y: PAUSE_BUTTON.art.y + PAUSE_BUTTON.art.height / 2,
    });
  const routes: Record<string, () => void> = {
    Escape: () => key("Escape"),
    P: () => key("P"),
    back: () => window.dispatchEvent(new Event("phone-back")),
    "frame turn": () => turns.change(),
    "pause button": tapPauseButton,
  };
  return {
    ...top,
    input,
    key,
    pause: pause as unknown as PauseState,
    press,
    routes,
    scenes,
    tap,
    tapPauseButton,
  };
}

const hudTarget = () => {
  const at = skillHud(["dash"]).get("dash")!;
  return { x: at.x + SKILL_BUTTON.target / 2, y: at.y + SKILL_BUTTON.target / 2 };
};

it.each(MODES)("takes a tap on the pause button through the %s's modal input", (mode) => {
  const { input, press, tapPauseButton } = conversation(mode);
  tapPauseButton();
  expect(press).toHaveBeenCalledExactlyOnceWith("pauseButton");
  expect(input.stopPropagation).toHaveBeenCalled();
});

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
    await vi.waitFor(() => expect(pause.state).toBe("open"));
    expect(scenes.pause).toHaveBeenCalledExactlyOnceWith(HELD[mode]);
    expect(modalInput(scene as never).accepts()).toBe(false);
    pause.showSkillHud();
    expect(pause.hud.get("dash")!.visible).toHaveBeenLastCalledWith(false);
    pause.press("resume");
    expect(pause.state).toBe("closed");
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
    const event = key(name);
    expect(event.stopPropagation).not.toHaveBeenCalled();
    expect(acted).not.toHaveBeenCalled();
    expect(state()).toEqual(before);
  },
);

it("advances the conversation on another key, which Pause leaves alone", () => {
  const { dialogue, key, pause, scenes } = conversation();
  dialogue.paragraph = 0;
  const event = key("x");
  expect(event.stopPropagation).toHaveBeenCalled();
  expect(dialogue.paragraph).toBe(1);
  expect(dialogue.drawParagraph).toHaveBeenCalledOnce();
  expect(pause.state).toBe("closed");
  expect(scenes.pause).not.toHaveBeenCalled();
});

it.each(["choice", "departure"] as const)(
  "acts on Enter in the %s, which Pause leaves alone",
  (mode) => {
    const { acted, key, pause, scenes } = conversation(mode);
    const event = key("Enter");
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(acted).toHaveBeenCalledOnce();
    expect(pause.state).toBe("closed");
    expect(scenes.pause).not.toHaveBeenCalled();
  },
);

it.each(MODES)(
  "shows the pause button and the skill HUD over the %s, leaving taps on the HUD to it",
  (mode) => {
    const { input, pause, press, tap } = conversation(mode);
    pause.showPauseButton();
    expect(pause.pauseButton.setVisible).toHaveBeenLastCalledWith(true);
    pause.showSkillHud();
    expect(pause.hud.get("dash")!.visible).toHaveBeenLastCalledWith(true);
    expect(pause.skillHudLive()).toBe(false);
    expect(pause.controlAt(hudTarget())).toBeUndefined();
    tap(hudTarget());
    expect(press).not.toHaveBeenCalled();
    expect(input.stopPropagation).not.toHaveBeenCalled();
  },
);
