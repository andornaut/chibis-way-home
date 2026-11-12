import { EventEmitter } from "node:events";
import { readdirSync, readFileSync } from "node:fs";

import type { Scene } from "phaser";
import { describe, expect, it } from "vitest";

import {
  ACHIEVEMENT_NOTICE,
  NOTICE_BLOCKING_SCENES,
  NOTICE_CHECKED_SCENES,
  noticeBlocked,
} from "./achievementNotice.ts";
import { modalInput } from "./modalInput.ts";

const SCENES = new URL(".", import.meta.url);
const MAIN = readFileSync(new URL("../main.ts", import.meta.url), "utf8");

// Each scene class main.ts registers, with the key its constructor passes.
const registered = readdirSync(SCENES)
  .filter((file) => file.endsWith("Scene.ts"))
  .flatMap((file) => {
    const source = readFileSync(new URL(file, SCENES), "utf8");
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
