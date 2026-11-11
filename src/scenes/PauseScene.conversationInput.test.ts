import { EventEmitter } from "node:events";

import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({ Scene: class {} }));
vi.mock("../ui/input/frameTurn", () => ({ FRAME_TURN: {} }));
vi.mock("../pwa", () => ({ coverZone: vi.fn(), startWakeLock: vi.fn(), stopWakeLock: vi.fn() }));

import { PAUSE_BUTTON } from "../ui";
import { DialogueScene } from "./DialogueScene";
import { modalInput } from "./modalInput";
import { PauseScene } from "./PauseScene";

beforeEach(() => vi.stubGlobal("window", {}));
afterEach(() => vi.unstubAllGlobals());

// A conversation holding the real modal input gate over the paused zone, and the pause scene
// beside it with no scope of its own, its presses watched as in play.
function conversation() {
  const game = { events: new EventEmitter() };
  const dialogue = Object.assign(new DialogueScene(), { events: new EventEmitter(), game });
  dialogue.init({ scene: "archie-intro" });
  modalInput(dialogue as never).open();
  const zone = { conversationCovers: () => true, playCovered: () => true };
  const input = Object.assign(new EventEmitter(), { stopPropagation: vi.fn() });
  const press = vi.fn();
  const pause = Object.assign(new PauseScene(), {
    events: new EventEmitter(),
    game,
    input,
    layout: { close: {} },
    pauseButton: { visible: true },
    press,
    scale: { gameSize: { height: 360, width: 720 } },
    scene: {
      get: (key: string) => (key === "zone" ? zone : dialogue),
      isActive: (key: string) => key === "dialogue",
      isPaused: (key: string) => key === "zone",
    },
    setPressed(this: { pressed: string | undefined }, value: string | undefined) {
      this.pressed = value;
    },
    time: { now: 0 },
  }) as unknown as { watchPresses(): void };
  pause.watchPresses();
  const tap = () => {
    const pointer = {
      id: 1,
      wasCanceled: false,
      x: PAUSE_BUTTON.art.x + PAUSE_BUTTON.art.width / 2,
      y: PAUSE_BUTTON.art.y + PAUSE_BUTTON.art.height / 2,
    };
    input.emit("pointerdown", pointer);
    input.emit("pointerup", pointer);
  };
  return { dialogue: dialogue as unknown as { choosing: boolean }, input, press, tap };
}

it("takes a tap on the pause button through the conversation's modal input", () => {
  const { input, press, tap } = conversation();
  tap();
  expect(press).toHaveBeenCalledExactlyOnceWith("pauseButton");
  expect(input.stopPropagation).toHaveBeenCalled();
});

it("leaves a tap on the pause button to the conversation's required choice", () => {
  const { dialogue, input, press, tap } = conversation();
  dialogue.choosing = true;
  tap();
  expect(press).not.toHaveBeenCalled();
  expect(input.stopPropagation).not.toHaveBeenCalled();
});
