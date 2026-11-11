import { afterEach, beforeEach, expect, it, vi } from "vitest";

const gate = vi.hoisted(() => ({ accepts: vi.fn(() => true), close: vi.fn(), open: vi.fn() }));
vi.mock("phaser", () => ({ Scene: class {} }));
vi.mock("../ui/input/frameTurn", () => ({ FRAME_TURN: {} }));
vi.mock("../pwa", () => ({ coverZone: vi.fn(), startWakeLock: vi.fn(), stopWakeLock: vi.fn() }));
vi.mock("../ui/settings/touchControls", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../ui/settings/touchControls")>()),
  coarsePointer: () => true,
}));
vi.mock("./modalInput", () => ({
  modalInput: () => gate,
  onGatedPointer: vi.fn(),
  onScenePointer: vi.fn(),
}));

import { ZONE_DIALOGUES } from "../data/dialogues";
import { ZONE_MAP } from "../data/map";
import { PAUSE_BUTTON } from "../ui";
import { type DialogueData, DialogueScene } from "./DialogueScene";
import { PauseScene } from "./PauseScene";

interface DialogueState {
  focus: string | undefined;
  paragraph: number;
  drawParagraph(): void;
}

interface PauseState {
  pauseButton: { setVisible: ReturnType<typeof vi.fn>; visible: boolean };
  state: string;
  close(): void;
  controlAt(pointer: { readonly x: number; readonly y: number }): string | undefined;
  open(): Promise<void>;
  showPauseButton(): void;
}

beforeEach(() => {
  vi.clearAllMocks();
  gate.accepts.mockReturnValue(true);
  // A touch screen: coarsePointer is mocked, so the page needs no properties.
  vi.stubGlobal("window", {});
});
afterEach(() => vi.unstubAllGlobals());

// The zone paused under a conversation, on its second line with Continue focused.
function conversation(data: DialogueData = { scene: "archie-intro" }) {
  const dialogue = new DialogueScene();
  dialogue.init(data);
  const lines = dialogue as unknown as DialogueState;
  lines.paragraph = 1;
  lines.focus = "continue";
  const drawParagraph = vi.spyOn(lines, "drawParagraph");
  const zone = {
    conversationCovers: () => true,
    playCovered: () => true,
    showTouchControls: vi.fn(),
  };
  const scenes = {
    get: (key: string) => (key === "zone" ? zone : dialogue),
    isActive: (key: string) => key === "dialogue",
    isPaused: (key: string) => key === "zone",
    pause: vi.fn(),
    resume: vi.fn(),
  };
  const pause = Object.assign(new PauseScene(), {
    card: { destroy: vi.fn() },
    dimZone: vi.fn(async () => {}),
    dims: new Map(),
    hud: new Map(),
    input: {},
    layout: { close: {} },
    pauseButton: { setVisible: vi.fn(), visible: true },
    redrawCard: vi.fn(),
    renderDim: vi.fn(),
    scale: { gameSize: { height: 360, width: 720 } },
    scene: scenes,
    setPressed: vi.fn(),
    showCard: vi.fn(),
    sys: { isActive: () => true },
  }) as unknown as PauseState;
  return { drawParagraph, lines, pause, scenes };
}

it("shows the pause button and takes its press while a conversation covers play", () => {
  const { pause } = conversation();
  pause.showPauseButton();
  expect(pause.pauseButton.setVisible).toHaveBeenLastCalledWith(true);
  expect(
    pause.controlAt({
      x: PAUSE_BUTTON.art.x + PAUSE_BUTTON.art.width / 2,
      y: PAUSE_BUTTON.art.y + PAUSE_BUTTON.art.height / 2,
    }),
  ).toBe("pauseButton");
});

const { id: zone, stages } = ZONE_MAP.destinations[0]!;

it.each<{ readonly data?: DialogueData; readonly name: string }>([
  { name: "a conversation" },
  {
    data: { clearedStage: stages.at(-1)!, scene: ZONE_DIALOGUES[zone]!.outro },
    name: "a zone's outgoing exchange",
  },
])("opens over $name and resumes it on the same line, the zone still paused", async ({ data }) => {
  const { drawParagraph, lines, pause, scenes } = conversation(data);
  await pause.open();
  expect(pause.state).toBe("open");
  expect(scenes.pause).toHaveBeenCalledExactlyOnceWith("dialogue");
  pause.close();
  expect(pause.state).toBe("closed");
  expect(scenes.resume).toHaveBeenCalledExactlyOnceWith("dialogue");
  expect({ focus: lines.focus, paragraph: lines.paragraph }).toEqual({
    focus: "continue",
    paragraph: 1,
  });
  expect(drawParagraph).not.toHaveBeenCalled();
  pause.showPauseButton();
  expect(pause.pauseButton.setVisible).toHaveBeenLastCalledWith(true);
});
