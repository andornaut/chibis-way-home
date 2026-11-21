// @vitest-environment happy-dom
import { EventEmitter } from "node:events";
import { readdirSync, readFileSync } from "node:fs";

import { fillNames } from "@andornaut/game-kit/runtime/lines";
import type { Scene } from "phaser";
import { describe, expect, it, vi } from "vitest";

const queue = vi.hoisted(() => ({
  ids: [] as string[],
  tips: [] as { id: string; skill?: string }[],
}));
vi.mock("phaser", () => ({ Scene: class {} }));
vi.mock("./save.ts", () => ({
  nextAchievementNotice: (blocked: () => boolean) => (blocked() ? undefined : queue.ids.shift()),
  nextTip: (blocked: () => boolean) =>
    queue.ids.length > 0 || blocked() ? undefined : queue.tips.shift(),
}));
vi.mock("./domUi.ts", () => ({
  artFrameUrl: (_scene: unknown, art: string, frame?: string) =>
    Promise.resolve(`blob:${art}/${frame ?? ""}`),
  mountSceneView: (scene: { events: EventEmitter }, view: HTMLElement) => {
    document.body.append(view);
    scene.events.once("shutdown", () => view.remove());
    return () => view.remove();
  },
}));

import palette from "../../public/art/palette.json" with { type: "json" };
import iconSheet from "../../public/art/sprites/icon-achievement.json" with { type: "json" };
import dashSheet from "../../public/art/sprites/icon-skill-dash.json" with { type: "json" };
import { ACHIEVEMENT_NOTICE_SECONDS } from "../data/achievements.ts";
import { SPEAKERS } from "../data/dialogues.ts";
import { TEXT } from "../data/text.ts";
import type { AchievementId, ControlAction } from "../data/types/index.ts";
import { ACHIEVEMENT_IDS } from "../progress/index.ts";
import { networkPlay } from "../pwa/index.ts";
import { DIALOGUE_SCREEN } from "../ui/index.ts";
import {
  ACHIEVEMENT_NOTICE,
  NOTICE_BLOCKING_SCENES,
  NOTICE_CHECKED_SCENES,
  noticeBlocked,
} from "./achievementNotice.ts";
import {
  achievementIconFrame,
  AchievementNoticeScene,
  TIP_SPEAKER,
} from "./AchievementNoticeScene.ts";
import { modalInput } from "./modalInput.ts";

// The sources are read from disk, from the project root.
const SCENES = "src/scenes";
const MAIN = readFileSync("src/main.ts", "utf8");

// Each scene class main.ts registers, with the key its constructor passes.
const registered = readdirSync(SCENES)
  .filter((file) => file.endsWith("Scene.ts"))
  .flatMap((file) => {
    const source = readFileSync(`${SCENES}/${file}`, "utf8");
    const name = /export class (\w+Scene) extends \w*Scene\b/.exec(source)?.[1];
    const key =
      /super\("(\w+)"\)/.exec(source)?.[1] ??
      /constructor\(\s*key = "(\w+)"/.exec(source)?.[1] ??
      (source.includes("super(ACHIEVEMENT_NOTICE)") ? ACHIEVEMENT_NOTICE : undefined);
    return name && MAIN.includes(`      ${name},\n`) ? [{ key, name }] : [];
  });

interface StubScenes {
  readonly active?: readonly string[];
  readonly barksIdle?: boolean;
  readonly paused?: readonly string[];
  readonly zoneBlocked?: boolean;
}

function stub({ active = [], barksIdle = true, paused = [], zoneBlocked = false }: StubScenes) {
  return {
    events: new EventEmitter(),
    game: { events: new EventEmitter() },
    scene: {
      get: (key: string) =>
        key === "zone" ? { noticeBlocked: () => zoneBlocked } : { idle: () => barksIdle },
      isActive: (key: string) => active.includes(key),
      isPaused: (key: string) => paused.includes(key),
    },
  } as unknown as Scene;
}

describe("deferring unlock notices", () => {
  it("classifies every scene main.ts registers", () => {
    const keys = registered.map(({ key }) => key);
    expect(registered.length).toBeGreaterThan(20);
    expect(keys.filter((key) => key === undefined)).toEqual([]);
    expect(
      keys.filter((key) => !NOTICE_BLOCKING_SCENES.has(key!) && !NOTICE_CHECKED_SCENES.has(key!)),
    ).toEqual([]);
    expect([...NOTICE_BLOCKING_SCENES].filter((key) => NOTICE_CHECKED_SCENES.has(key))).toEqual([]);
  });

  it.each<[string, StubScenes, boolean]>([
    ["play goes on", { active: ["zone", "zoneBark", "pause", "achievementNotice"] }, false],
    ["the start screen shows", { active: ["start", "pause"] }, false],
    ["a cutscene plays", { active: ["cutscene"] }, true],
    ["a paused dialogue shows", { paused: ["dialogue"] }, true],
    ["the room is open", { active: ["room"], paused: ["zone"] }, true],
    ["the Achievements card shows", { active: ["start", "achievements"] }, true],
    ["a bark waits or shows", { active: ["zone", "zoneBark"], barksIdle: false }, true],
    ["the zone is covered or ending", { active: ["zone"], zoneBlocked: true }, true],
  ])("defers a notice only when it must: %s", (_, scenes, blocked) => {
    expect(noticeBlocked(stub(scenes))).toBe(blocked);
  });

  it("defers a notice while any modal card holds input", () => {
    const scene = stub({ active: ["zone"] });
    const card = stub({});
    (card as unknown as { game: unknown }).game = (scene as unknown as { game: unknown }).game;
    modalInput(card).open();
    expect(noticeBlocked(scene)).toBe(true);
    modalInput(card).close();
    expect(noticeBlocked(scene)).toBe(false);
  });
});

describe("the unlock notice", () => {
  const ID = ACHIEVEMENT_IDS[0]! as AchievementId;
  const { box } = DIALOGUE_SCREEN;

  // The notice scene over play, with id queued, and whether its blocking scenes run.
  async function notice() {
    queue.ids = [ID];
    const running = { room: false };
    const scene = Object.assign(new AchievementNoticeScene(), {
      cache: { json: { get: () => iconSheet } },
      events: new EventEmitter(),
      game: { events: new EventEmitter() },
      scene: {
        get: () => ({ idle: () => true, noticeBlocked: () => false }),
        isActive: (key: string) => key === "room" && running.room,
        isPaused: () => false,
      },
    });
    const panel = () => document.querySelector<HTMLElement>(".dialogue-panel")!;
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (
      this: Element,
    ) {
      return this.classList.contains("dialogue-panel")
        ? new DOMRect(box.x, box.y, box.width, box.height)
        : new DOMRect();
    });
    scene.create();
    scene.update(0, 0);
    // The notice shows once its icon's cut is ready.
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    scene.update(0, 0);
    return { panel, running, scene };
  }

  it("shows the unlocked icon, the filled notice line and the description", async () => {
    const { panel, scene } = await notice();
    expect(panel().hidden).toBe(false);
    const entry = TEXT.achievements.entries[ID];
    const portrait = panel().querySelector<HTMLImageElement>(".dialogue-portrait")!;
    expect({
      heading: panel().querySelector(".dialogue-heading")?.textContent,
      icon: [portrait.hidden, portrait.getAttribute("src")],
      line: panel().querySelector(".dialogue-line")?.textContent,
      status: panel().closest("[role=status]") !== null,
      tab: panel().querySelector<HTMLElement>(".dialogue-name-tab")?.hidden,
    }).toEqual({
      heading: fillNames(TEXT.achievements.notice, { title: entry.title }),
      icon: [false, `blob:icon-achievement/${achievementIconFrame(scene, true, ID)}`],
      line: entry.description,
      status: true,
      tab: true,
    });
    scene.events.emit("shutdown");
    vi.restoreAllMocks();
  });

  it("hides while deferred, holding its time, and a fresh tap on it dismisses it", async () => {
    const { panel, running, scene } = await notice();
    running.room = true;
    scene.update(0, ACHIEVEMENT_NOTICE_SECONDS * 2000);
    expect([panel().hidden, scene.showing()]).toEqual([true, true]);
    running.room = false;
    scene.update(0, ACHIEVEMENT_NOTICE_SECONDS * 1000 - 1);
    expect([panel().hidden, scene.showing()]).toEqual([false, true]);
    const at = {
      bubbles: true,
      button: 0,
      clientX: box.x + 1,
      clientY: box.y + 1,
      isPrimary: true,
      pointerId: 1,
    };
    document.body.dispatchEvent(new PointerEvent("pointerdown", at));
    document.body.dispatchEvent(new PointerEvent("pointerup", at));
    expect([panel().hidden, scene.showing()]).toEqual([true, false]);
    scene.events.emit("shutdown");
    vi.restoreAllMocks();
  });
});

describe("the tip", () => {
  const { box } = DIALOGUE_SCREEN;
  const speaker = SPEAKERS[TIP_SPEAKER]!;
  // A token's label: the tip's skill's title, or the control's.
  const word = (token: string) =>
    token === "skill" ? TEXT.skills.dash.title : TEXT.buttons[token as ControlAction];

  // The notice scene with the first power-up's tip for Dash queued behind one unlock, and whether
  // play shows.
  async function tip() {
    queue.ids = [ACHIEVEMENT_IDS[0]!];
    queue.tips = [{ id: "powerUp", skill: "dash" }];
    const play = { shown: false };
    const sheets: Readonly<Record<string, unknown>> = { "icon-achievement": iconSheet, palette };
    const scene = Object.assign(new AchievementNoticeScene(), {
      cache: { json: { get: (key: string) => sheets[key] ?? dashSheet } },
      events: new EventEmitter(),
      game: { events: new EventEmitter() },
      scene: {
        get: () => ({
          idle: () => true,
          noticeBlocked: () => false,
          skillState: () => ({ shown: play.shown }),
        }),
        isActive: (key: string) => key === "zone",
        isPaused: () => false,
      },
    });
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(
      new DOMRect(box.x, box.y, box.width, box.height),
    );
    scene.create();
    const panel = () => document.querySelector<HTMLElement>(".dialogue-panel")!;
    const step = async (delta: number) => {
      scene.update(0, delta);
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
      scene.update(0, 0);
    };
    return { panel, play, scene, step };
  }

  it("waits behind the unlock and for play, then shows the Tip speaker with inline icons", async () => {
    const { panel, play, scene, step } = await tip();
    await step(0);
    expect(panel().dataset.notice).toBe("achievement");
    await step(ACHIEVEMENT_NOTICE_SECONDS * 1000);
    expect(scene.showing()).toBe(false);
    play.shown = true;
    await step(0);
    const line = panel().querySelector(".dialogue-line")!;
    const tab = panel().querySelector<HTMLElement>(".dialogue-name-tab")!;
    expect({
      glyph: line.querySelector(".ui-action-help-glyph")?.getAttribute("src"),
      hidden: panel().hidden,
      labels: [...line.querySelectorAll(".ui-action-help-label")].map(
        ({ textContent }) => textContent,
      ),
      line: line.textContent,
      notice: panel().dataset.notice,
      portrait: panel().querySelector(".dialogue-portrait")?.getAttribute("src"),
      side: panel().dataset.side,
      tab: [tab.hidden, tab.textContent, tab.dataset.colour],
    }).toEqual({
      glyph: "blob:icon-skill-dash/icon-skill-dash 0.aseprite",
      hidden: false,
      labels: [...TEXT.tips.powerUp.matchAll(/\{(\w+)\}/gu)].map(([, token]) => word(token!)),
      line: TEXT.tips.powerUp.replace(/\{(\w+)\}/gu, (_, token: string) => word(token)),
      notice: "tip",
      portrait: `blob:${speaker.portrait}/`,
      side: speaker.side,
      tab: [false, TEXT.dialogue.speakers[TIP_SPEAKER], speaker.colour],
    });
    // Play keeps running: the tip opens no modal input scope, and hides while play does not show.
    expect(modalInput(scene).accepts()).toBe(true);
    play.shown = false;
    scene.update(0, ACHIEVEMENT_NOTICE_SECONDS * 2000);
    expect([panel().hidden, scene.showing()]).toEqual([true, true]);
    play.shown = true;
    scene.update(0, ACHIEVEMENT_NOTICE_SECONDS * 1000);
    expect([panel().hidden, scene.showing()]).toEqual([true, false]);
    scene.events.emit("shutdown");
    vi.restoreAllMocks();
  });
});

describe("the network play notice", () => {
  it("shows its line once on the start screen, before an unlock, and play proceeds", async () => {
    queue.ids = [ACHIEVEMENT_IDS[0]!];
    queue.tips = [];
    const scene = Object.assign(new AchievementNoticeScene(), {
      cache: { json: { get: () => iconSheet } },
      events: new EventEmitter(),
      game: { events: new EventEmitter() },
      scene: {
        get: () => ({ idle: () => true, noticeBlocked: () => false }),
        isActive: (key: string) => key === "start",
        isPaused: () => false,
      },
    });
    scene.create();
    const panel = () => document.querySelector<HTMLElement>(".dialogue-panel")!;
    const frame = () => panel().querySelector<HTMLElement>(".dialogue-portrait-frame")!;
    const step = async (delta: number) => {
      scene.update(0, delta);
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
      scene.update(0, 0);
    };
    networkPlay.report();
    await step(0);
    expect({
      frame: frame().hidden,
      heading: panel().querySelector<HTMLElement>(".dialogue-heading")!.hidden,
      hidden: panel().hidden,
      line: panel().querySelector(".dialogue-line")?.textContent,
      notice: panel().dataset.notice,
      tab: panel().querySelector<HTMLElement>(".dialogue-name-tab")!.hidden,
    }).toEqual({
      frame: true,
      heading: true,
      hidden: false,
      line: TEXT.loading.networkPlay,
      notice: "networkPlay",
      tab: true,
    });
    // It opens no modal input scope, so the start screen keeps its input.
    expect(modalInput(scene).accepts()).toBe(true);
    await step(ACHIEVEMENT_NOTICE_SECONDS * 1000);
    expect([panel().dataset.notice, frame().hidden]).toEqual(["achievement", false]);
    await step(ACHIEVEMENT_NOTICE_SECONDS * 1000);
    expect(scene.showing()).toBe(false);
    networkPlay.report();
    await step(0);
    expect(scene.showing()).toBe(false);
    scene.events.emit("shutdown");
  });
});
