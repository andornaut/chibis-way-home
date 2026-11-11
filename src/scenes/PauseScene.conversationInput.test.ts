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

import { PAUSE_BUTTON, SKILL_BUTTON, skillHud } from "../ui";
import { DialogueScene } from "./DialogueScene";
import { modalInput } from "./modalInput";
import { PauseScene } from "./PauseScene";

beforeEach(() => vi.stubGlobal("window", new EventTarget()));
afterEach(() => vi.unstubAllGlobals());

interface DialogueState {
  choosing: boolean;
  focus: string | undefined;
  paragraph: number;
}

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

// A conversation holding the real modal input gate over the paused zone, on its second line with
// Continue focused, and the pause scene beside it with no scope of its own, its presses, keys,
// back and frame turns watched as in play.
function conversation(departure = false) {
  const game = { events: new EventEmitter() };
  const keyboard = () =>
    Object.assign(new EventEmitter(), { addCapture: vi.fn(), removeCapture: vi.fn() });
  const dialogueInput = Object.assign(new EventEmitter(), {
    keyboard: keyboard(),
    stopPropagation: vi.fn(),
  });
  const drawParagraph = vi.fn();
  const dialogue = Object.assign(new DialogueScene("dialogue", departure) as object, {
    drawParagraph,
    events: new EventEmitter(),
    game,
    input: dialogueInput,
  }) as unknown as DialogueScene;
  dialogue.init({ scene: departure ? "archie-outro" : "archie-intro" });
  const lines = dialogue as unknown as DialogueState;
  lines.paragraph = 1;
  lines.focus = "continue";
  modalInput(dialogue as never).open();
  (dialogue as unknown as { watchInput(): void }).watchInput();
  const zone = {
    conversationCovers: () => !departure,
    playCovered: () => true,
    showTouchControls: vi.fn(),
    skillState: () => undefined,
  };
  const scenes = {
    get: (key: string) => (key === "zone" ? zone : dialogue),
    isActive: (key: string) => key === "dialogue",
    isPaused: (key: string) => key === "zone",
    pause: vi.fn(),
    resume: vi.fn(),
  };
  const input = Object.assign(new EventEmitter(), {
    keyboard: keyboard(),
    stopPropagation: vi.fn(),
  });
  const pause = Object.assign(new PauseScene(), {
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
    scale: { gameSize: { height: 360, width: 720 } },
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
    dialogueInput.keyboard.emit("keydown", event);
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
    dialogue,
    drawParagraph,
    input,
    key,
    lines,
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

it("takes a tap on the pause button through the conversation's modal input", () => {
  const { input, press, tapPauseButton } = conversation();
  tapPauseButton();
  expect(press).toHaveBeenCalledExactlyOnceWith("pauseButton");
  expect(input.stopPropagation).toHaveBeenCalled();
});

it("leaves a tap on the pause button to the conversation's required choice", () => {
  const { input, lines, press, tapPauseButton } = conversation();
  lines.choosing = true;
  tapPauseButton();
  expect(press).not.toHaveBeenCalled();
  expect(input.stopPropagation).not.toHaveBeenCalled();
});

it.each(["P", "Escape", "back", "frame turn", "pause button"])(
  "opens over the conversation by %s, keeping its line, and resumes to it",
  async (route) => {
    const { dialogue, drawParagraph, lines, pause, routes, scenes } = conversation();
    routes[route]!();
    await vi.waitFor(() => expect(pause.state).toBe("open"));
    expect(scenes.pause).toHaveBeenCalledExactlyOnceWith("dialogue");
    expect(modalInput(dialogue as never).accepts()).toBe(false);
    pause.press("resume");
    expect(pause.state).toBe("closed");
    expect(scenes.resume).toHaveBeenCalledExactlyOnceWith("dialogue");
    expect({ focus: lines.focus, paragraph: lines.paragraph }).toEqual({
      focus: "continue",
      paragraph: 1,
    });
    expect(drawParagraph).not.toHaveBeenCalled();
    expect(modalInput(dialogue as never).accepts()).toBe(true);
  },
);

it.each(["p", "P", "Escape"])(
  "passes %s on from the conversation to Pause without advancing",
  (name) => {
    const { drawParagraph, key, lines } = conversation();
    const event = key(name);
    expect(event.stopPropagation).not.toHaveBeenCalled();
    expect(lines.paragraph).toBe(1);
    expect(drawParagraph).not.toHaveBeenCalled();
  },
);

it("advances the conversation on another key, which Pause leaves alone", () => {
  const { drawParagraph, key, lines, pause, scenes } = conversation();
  lines.paragraph = 0;
  const event = key("x");
  expect(event.stopPropagation).toHaveBeenCalled();
  expect(lines.paragraph).toBe(1);
  expect(drawParagraph).toHaveBeenCalledOnce();
  expect(pause.state).toBe("closed");
  expect(scenes.pause).not.toHaveBeenCalled();
});

it("shows the skill HUD over the conversation and leaves taps on it to the conversation", () => {
  const { input, pause, press, tap } = conversation();
  pause.showSkillHud();
  expect(pause.hud.get("dash")!.visible).toHaveBeenLastCalledWith(true);
  expect(pause.skillHudLive()).toBe(false);
  expect(pause.controlAt(hudTarget())).toBeUndefined();
  tap(hudTarget());
  expect(press).not.toHaveBeenCalled();
  expect(input.stopPropagation).not.toHaveBeenCalled();
});

it.each([
  { departure: false, name: "required choice" },
  { departure: true, name: "departure" },
])("leaves the $name as before: no pause button, skill HUD or Pause", async ({ departure }) => {
  const { lines, pause, routes, scenes } = conversation(departure);
  if (!departure) {
    lines.choosing = true;
  }
  pause.showPauseButton();
  expect(pause.pauseButton.setVisible).toHaveBeenLastCalledWith(false);
  pause.showSkillHud();
  expect(pause.hud.get("dash")!.visible).toHaveBeenLastCalledWith(false);
  for (const route of ["P", "Escape", "back", "frame turn"]) {
    routes[route]!();
  }
  await Promise.resolve();
  expect(pause.state).toBe("closed");
  expect(scenes.pause).not.toHaveBeenCalled();
});
