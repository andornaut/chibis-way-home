import { describe, expect, it } from "vitest";

import { BIRD_FRAME } from "../assets/index.ts";
import { STEP_SECONDS } from "../core/index.ts";
import { BIRD } from "../data/bird.ts";
import type {
  Archetype,
  BehaviourPlan,
  ObjectLayout,
  Rect,
  ZoneLayout,
} from "../data/types/index.ts";
import { SKILL_PROFILES } from "../progress/index.ts";
import { defeatBoss } from "./bossDefeat.ts";
import { objectLayout } from "./tiles.ts";
import { leaveRoom, startZone, stepZone, type ZoneState } from "./zone.ts";

const archetype: Archetype = {
  collision: "hazard",
  interaction: { kind: "none", range: 0 },
  motion: {
    algorithm: "static",
    direction: "right",
    distance: 0,
    hopHeight: 0,
    pause: 0,
    speed: 0,
    variance: 0,
  },
  reaction: { kind: "none", range: 0, speed: 0 },
};
const escaped = { line: "escaped", speaker: "actor" };
const floor: Rect = { height: 100, width: 4000, x: -1000, y: 300 };
const plan: BehaviourPlan = {
  axis: "x",
  distance: -20,
  initial: "watch",
  pursuit: { distance: 2160, escaped, unreachableGraceSeconds: null },
  states: {
    chase: {
      animation: "walk",
      motion: { kind: "pursue", mode: "ground", speed: 100 },
      transitions: [],
    },
    watch: {
      animation: "idle",
      motion: { kind: "wait" },
      transitions: [{ to: "chase", when: [{ kind: "visible" }] }],
    },
  },
};
const boss = objectLayout(
  1,
  {
    archetypes: { actor: archetype },
    characters: {
      actor: { archetype: "actor", art: "actor", behaviour: plan, cols: 20, rows: 20 },
    },
  },
  {},
  undefined,
  {},
  { character: "actor", col: 100, row: 280 },
);
const physical: ObjectLayout = { ...boss };
delete (physical as { behaviour?: unknown }).behaviour;
const refuge: ObjectLayout = {
  ...physical,
  character: "refuge",
  collision: "ledge",
  height: 20,
  origin: { x: 350, y: 136 },
  width: 200,
};
const door: ObjectLayout = {
  ...physical,
  character: "door",
  collision: "use",
  height: 60,
  origin: { x: 370, y: 76 },
  width: 60,
};
const BOSS = 1;
const layout: ZoneLayout = {
  areas: {
    main: {
      backX: -1000,
      chunks: [{ width: 4000, x: -1000 }],
      entries: { start: { x: 400, y: 136 } },
      exitX: 3000,
      height: 720,
      objects: [refuge, boss, door],
      solids: [floor],
      terrain: [],
      tileset: undefined,
      width: 4000,
    },
  },
  birdFrame: BIRD_FRAME,
  start: { area: "main", entry: "start" },
};
const still = { jumpHeld: false, move: 0, useHeld: false } as const;
const owner = (attempt = 0) => ({ area: "main", attempt, objectIndex: BOSS });
const escapeBarks = (zone: ZoneState) => zone.barks.filter(({ line }) => line === escaped.line);

// The boss engaged, with Chibi on the refuge in front of the door.
function engaged(): ZoneState {
  const zone = stepZone(
    SKILL_PROFILES,
    BIRD,
    layout,
    STEP_SECONDS,
    still,
    startZone(BIRD, layout, 1),
  );
  expect(zone.behaviours[BOSS]?.pursuit?.phase).toBe("engaged");
  return zone;
}

// Chibi moved beyond the pursuit distance, optionally also below the area, so he dies there.
const fled = (zone: ZoneState, falls: boolean): ZoneState => ({
  ...zone,
  bird: { ...zone.bird, x: 3000, y: falls ? 800 : zone.bird.y },
});

describe("zone escapes", () => {
  it("reports a distance escape with its bark", () => {
    const zone = stepZone(
      SKILL_PROFILES,
      BIRD,
      layout,
      STEP_SECONDS,
      still,
      fled(engaged(), false),
    );
    expect(zone.death).toBeUndefined();
    expect(zone.escapes).toEqual([{ cause: "distance", owner: owner() }]);
    expect(escapeBarks(zone)).toHaveLength(1);
  });

  it("credits no escape on a death step", () => {
    const zone = stepZone(SKILL_PROFILES, BIRD, layout, STEP_SECONDS, still, fled(engaged(), true));
    expect(zone.death?.reason).toBe("fall");
    expect(zone.behaviours[BOSS]?.pursuit?.phase).toBe("escaped");
    expect(zone.escapes).toEqual([]);
  });

  it("ends pursuit as an escape when Chibi enters a room door, without an escape bark", () => {
    const entered = stepZone(
      SKILL_PROFILES,
      BIRD,
      layout,
      STEP_SECONDS,
      { ...still, useHeld: true },
      engaged(),
    );
    expect(entered.door).toBe(2);
    expect(entered.behaviours[BOSS]?.pursuit).toMatchObject({ phase: "escaped", settled: false });
    expect(entered.escapes).toEqual([{ cause: "door", owner: owner() }]);
    expect(escapeBarks(entered)).toEqual([]);
    let zone = leaveRoom(entered);
    for (let step = 0; step < 30; step++) {
      zone = stepZone(SKILL_PROFILES, BIRD, layout, STEP_SECONDS, still, zone);
      expect(escapeBarks(zone)).toEqual([]);
      expect(zone.escapes.filter(({ cause }) => cause === "door")).toEqual([]);
    }
  });

  it("leaves a dead boss out of a door escape", () => {
    const zone = engaged();
    const dead = {
      ...zone,
      behaviours: zone.behaviours.map((state, index) =>
        index === BOSS && state ? defeatBoss(state) : state,
      ),
    };
    const entered = stepZone(
      SKILL_PROFILES,
      BIRD,
      layout,
      STEP_SECONDS,
      { ...still, useHeld: true },
      dead,
    );
    expect(entered.door).toBe(2);
    expect(entered.escapes).toEqual([]);
  });
});
