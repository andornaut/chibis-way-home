// @vitest-environment happy-dom
import { EventEmitter } from "node:events";
import { readdirSync, readFileSync } from "node:fs";

import { fillNames } from "@andornaut/game-kit/lines";
import type { Scene } from "phaser";
import { describe, expect, it, vi } from "vitest";

const queue = vi.hoisted(() => ({ ids: [] as string[] }));
vi.mock("phaser", () => ({ Scene: class {} }));
vi.mock("./save.ts", () => ({
  nextAchievementNotice: (blocked: () => boolean) => (blocked() ? undefined : queue.ids.shift()),
}));
vi.mock("./domUi.ts", () => ({
  artFrameUrl: (_scene: unknown, art: string, frame: string) =>
    Promise.resolve(`blob:${art}/${frame}`),
  mountSceneView: (scene: { events: EventEmitter }, view: HTMLElement) => {
    document.body.append(view);
    scene.events.once("shutdown", () => view.remove());
    return () => view.remove();
  },
}));

import iconSheet from "../../public/art/sprites/icon-achievement.json" with { type: "json" };
import { ACHIEVEMENT_NOTICE_SECONDS } from "../data/achievements.ts";
import { TEXT } from "../data/text.ts";
import type { AchievementId } from "../data/types/index.ts";
import { ACHIEVEMENT_IDS } from "../progress/index.ts";
import { DIALOGUE_SCREEN } from "../ui/index.ts";
import {
  ACHIEVEMENT_NOTICE,
  NOTICE_BLOCKING_SCENES,
  NOTICE_CHECKED_SCENES,
  noticeBlocked,
} from "./achievementNotice.ts";
import { achievementIconFrame, AchievementNoticeScene } from "./AchievementNoticeScene.ts";
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
    await Promise.resolve();
    return { panel, running, scene };
  }

  it("shows the unlocked icon, the filled notice line and the description", async () => {
    const { panel, scene } = await notice();
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
    const at = { bubbles: true, clientX: box.x + 1, clientY: box.y + 1, pointerId: 1 };
    document.body.dispatchEvent(new PointerEvent("pointerdown", at));
    document.body.dispatchEvent(new PointerEvent("pointerup", at));
    expect([panel().hidden, scene.showing()]).toEqual([true, false]);
    scene.events.emit("shutdown");
    vi.restoreAllMocks();
  });
});
