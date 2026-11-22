// @vitest-environment happy-dom
import type { EventEmitter } from "node:events";

import { createLoadingAttempts } from "@andornaut/game-kit/runtime/load/loadingAttempts";
import { beforeEach, expect, it, vi } from "vitest";

interface FixtureGame {
  readonly destroy: ReturnType<typeof vi.fn>;
  readonly events: EventEmitter;
  readonly loop: {
    readonly running: boolean;
    readonly started: boolean;
    readonly wake: ReturnType<typeof vi.fn>;
  };
}
const startup = vi.hoisted(() => ({
  bridge: vi.fn(),
  constructorFailure: false,
  games: [] as FixtureGame[],
  install: vi.fn(),
  modality: vi.fn(),
  orientation: vi.fn(),
  setup: vi.fn(),
  signals: [] as AbortSignal[],
  started: true,
}));
vi.mock("phaser", async () => {
  const { EventEmitter } = await import("node:events");
  return {
    Core: { Events: { DESTROY: "destroy" } },
    Game: class {
      readonly destroy = vi.fn();
      readonly events = new EventEmitter();
      readonly loop = { running: false, started: startup.started, wake: vi.fn() };
      readonly scale = { gameSize: { height: 360, width: 720 } };
      constructor(config: { callbacks: { preBoot: (game: unknown) => void } }) {
        startup.games.push(this);
        config.callbacks.preBoot(this);
        if (startup.constructorFailure) {
          startup.constructorFailure = false;
          throw new Error("Renderer creation failed");
        }
      }
    },
    Scale: { CENTER_HORIZONTALLY: 1, NONE: 0 },
    WEBGL: 2,
  };
});
vi.mock("@andornaut/game-kit/runtime/clock/phaser/capFrameRate", () => ({ capFrameRate: vi.fn() }));
vi.mock("@andornaut/game-kit/runtime/web/ui/dom/focusModality", () => ({
  trackInputModality: startup.modality,
}));
vi.mock("@andornaut/game-kit/runtime/web/view/dom/watchFrameTurn", () => ({
  lockGameOrientation: startup.orientation,
}));
vi.mock("@andornaut/game-kit/runtime/web/view/phaser/followFrameTurn", () => ({
  followFrameTurn: vi.fn(),
}));
vi.mock("../crash/crashScreen.ts", () => ({ CRASH_SCREEN: { stopGameOnCrash: vi.fn() } }));
vi.mock("../pwa/index.ts", () => ({ setupPhoneApp: startup.setup }));
vi.mock("../pwa/installOffer.ts", () => ({ installOffer: startup.install }));
vi.mock("../scenes/domUi.ts", () => ({ mountDomUi: () => vi.fn() }));
vi.mock("../scenes/save.ts", () => ({}));
vi.mock("../ui/input/frameTurn.ts", () => ({ FRAME_TURN: {} }));

beforeEach(() => {
  vi.resetModules();
  startup.games.length = 0;
  startup.signals.length = 0;
  startup.constructorFailure = false;
  startup.started = true;
  startup.bridge.mockReset();
  startup.setup.mockReset().mockResolvedValue("play");
  startup.install.mockClear();
  startup.modality.mockClear();
  startup.orientation.mockClear();
  // The scene implementations have their own focused checks; this test owns Game acquisition.
  for (const name of [
    "AchievementNoticeScene",
    "AchievementsScene",
    "BootScene",
    "CelebrationScene",
    "CheatsScene",
    "CutsceneScene",
    "DeathScene",
    "DialogueChoiceScene",
    "DialogueScene",
    "MapScene",
    "OpeningScene",
    "PauseScene",
    "RestartScene",
    "RoomScene",
    "SettingsScene",
    "SkillDetailScene",
    "StageSelectScene",
    "StartScene",
    "UpdateScene",
    "ZoneBarkScene",
    "ZoneDepartureScene",
    "ZoneIntroductionScene",
    "ZoneScene",
  ]) {
    vi.doMock(`../scenes/${name}.ts`, () => ({
      [name]: class {
        constructor(signal?: AbortSignal) {
          if (name === "BootScene" && signal !== undefined) {
            startup.signals.push(signal);
          }
        }
      },
      ...(name === "UpdateScene" ? { installUpdateModalBridge: startup.bridge } : {}),
    }));
  }
});
const settle = () =>
  new Promise<void>((resolve) => {
    setImmediate(resolve);
  });

it("awaits actual destruction before replacement and retains only one committed Game", async () => {
  startup.bridge.mockImplementationOnce(() => {
    throw new Error("Game setup failed");
  });
  const { bootstrap } = await import("../main.ts");
  const attempts = createLoadingAttempts({ load: bootstrap, onState: () => {} });
  await attempts.start();
  const first = startup.games[0]!;
  expect(attempts.state.kind).toBe("failed");
  expect(startup.signals[0]!.aborted).toBe(true);
  expect(first.destroy).toHaveBeenCalledExactlyOnceWith(true);
  expect(first.loop.wake).toHaveBeenCalledOnce();
  const retry = attempts.retry();
  await settle();
  expect(startup.games).toHaveLength(1);
  first.events.emit("destroy");
  await retry;
  expect(startup.games).toHaveLength(2);
  expect(attempts.state.kind).toBe("ready");
  expect(startup.setup).toHaveBeenCalledOnce();
  expect(startup.install).toHaveBeenCalledOnce();
  expect(startup.modality).toHaveBeenCalledOnce();
  expect(startup.orientation).toHaveBeenCalledOnce();
  attempts.dispose();
  expect(startup.signals[1]!.aborted).toBe(false);
  expect(startup.games[1]!.destroy).not.toHaveBeenCalled();
});

it("does not wake an unstarted loop or acquire after a waiting replacement is cancelled", async () => {
  startup.started = false;
  startup.constructorFailure = true;
  const { bootstrap } = await import("../main.ts");
  const attempts = createLoadingAttempts({ load: bootstrap, onState: () => {} });
  await attempts.start();
  const first = startup.games[0]!;
  expect(startup.signals[0]!.aborted).toBe(true);
  expect(first.destroy).toHaveBeenCalledExactlyOnceWith(true);
  expect(first.loop.wake).not.toHaveBeenCalled();
  const retry = attempts.retry();
  await settle();
  expect(startup.games).toHaveLength(1);
  attempts.dispose();
  first.events.emit("destroy");
  await retry;
  expect(startup.games).toHaveLength(1);
  expect(attempts.state.kind).toBe("disposed");
});

it("constructs no game while the launch reloads into another build", async () => {
  startup.setup.mockResolvedValue("reloading");
  const { bootstrap } = await import("../main.ts");
  const attempts = createLoadingAttempts({ load: bootstrap, onState: () => {} });
  await attempts.start();
  expect(startup.setup).toHaveBeenCalledOnce();
  expect(startup.games).toHaveLength(0);
  attempts.dispose();
});
