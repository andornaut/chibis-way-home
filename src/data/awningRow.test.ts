import { describe, expect, it } from "vitest";

import { BIRD_FRAME } from "../assets";
import { STEP_SECONDS } from "../core";
import { SKILL_PROFILES } from "../progress";
import { effectiveCollision } from "../rules/effectiveCollision";
import { zoneLayout } from "../rules/tiles";
import { startZone, stepZone, type ZoneInput, type ZoneState } from "../rules/zone";
import { CHUNK_LIBRARY } from "../rules/zonePlans";
import { CATALOGUE, HITBOXES, TILESETS } from "../testing/art";
import { chunkThemePlan } from "../testing/chunkWalkCases";
import { BIRD } from "./bird";
import { CERTIFIED_LISTS } from "./certified";
import { CHUNKS } from "./chunks";
import { MODULES } from "./modules";
import { AWNING_SECONDS } from "./obstacleBehaviours";
import { TILE } from "./screen";
import type { BehaviourPlan } from "./types";

const ordinary = { ...BIRD, doubleJump: false };
delete ordinary.dash;
const idle = { jumpHeld: false, move: 0, useHeld: false } as const;
const CYCLE_SECONDS = Object.values(AWNING_SECONDS).reduce((sum: number, s) => sum + s, 0);
const ROUTE_TICKS = 600;
const PAIR = "home-homecity-stoop--awning-row";
const AWNING = "homecity-awning-ledge";

function fixture() {
  const chunk = CHUNK_LIBRARY.chunks[PAIR];
  if (!chunk) {
    throw new Error(`${PAIR} is not certified`);
  }
  const plan = chunkThemePlan(
    { fills: { door: [], event: [] }, theme: "back-streets" },
    CHUNK_LIBRARY,
    chunk,
  );
  const layout = zoneLayout(TILE, BIRD_FRAME, CATALOGUE, HITBOXES, TILESETS, new Set(), plan);
  const area = layout.areas[layout.start.area]!;
  const awnings = area.objects.flatMap(({ character }, index) =>
    character === AWNING ? [index] : [],
  );
  const solid = (col: number, row: number) =>
    chunk.solids.find((s) => s.row === row && s.col <= col && s.col + s.cols > col)!;
  // The entry run, lower street and exit run of the awning half, in px.
  const entry = solid(31, 80);
  return {
    area,
    awnings,
    chunk,
    entryRight: (entry.col + entry.cols) * TILE,
    layout,
    lower: solid(45, 88).row * TILE,
    upper: entry.row * TILE,
  };
}

type Fixture = ReturnType<typeof fixture>;
const stateOf = (f: Fixture, zone: ZoneState, awning: number) =>
  zone.behaviours[f.awnings[awning]!]?.stateKey ??
  f.area.objects[f.awnings[awning]!]!.behaviour!.initial;
const step = (f: Fixture, zone: ZoneState, input: ZoneInput) =>
  stepZone(SKILL_PROFILES, ordinary, f.layout, STEP_SECONDS, input, zone);
const feet = (zone: ZoneState) => zone.bird.y + ordinary.height;
const centre = (f: Fixture, awning: number) => {
  const object = f.area.objects[f.awnings[awning]!]!;
  return object.origin.x + (object.width - ordinary.width) / 2;
};
// Toward goal, jumping where the terrain ahead rises above his feet.
function toward(f: Fixture, zone: ZoneState, goal: number, jump: { until: number }, tick: number) {
  const move: ZoneInput["move"] =
    Math.abs(goal - zone.bird.x) <= 2 ? 0 : goal > zone.bird.x ? 1 : -1;
  const ahead = move > 0 ? zone.bird.x + ordinary.width + TILE : zone.bird.x - TILE;
  const rising = f.chunk.solids.some(
    ({ col, cols, row }) =>
      move !== 0 &&
      row * TILE < feet(zone) - 1e-6 &&
      (move > 0
        ? col * TILE > zone.bird.x && col * TILE <= ahead
        : (col + cols) * TILE < zone.bird.x + ordinary.width && (col + cols) * TILE >= ahead),
  );
  if (zone.bird.grounded && rising && tick >= jump.until) {
    jump.until = tick + 40;
  }
  return { ...idle, jumpHeld: tick < jump.until, move };
}

// From where he stands on the entry run: onto each awning when it reads out, then onto the exit
// run. Decides only from the awnings' observed states.
function cross(f: Fixture, start: ZoneState, limit: number) {
  const goals = [...f.awnings.map((_, awning) => centre(f, awning)), f.chunk.cols * TILE];
  const edge = f.entryRight - ordinary.width;
  let zone = start;
  let at = -1;
  let target = edge;
  let held = 0;
  const visited: number[] = [];
  const jump = { until: 0 };
  let ticks = 0;
  for (; ticks < limit && !zone.cleared; ticks++) {
    const settled =
      zone.bird.grounded && feet(zone) === f.upper && Math.abs(zone.bird.x - target) <= 2;
    if (settled && at < goals.length - 1) {
      const next = at + 1;
      // Commit only on an observed out: warning still leaves a hop's airtime.
      if (next === goals.length - 1 || stateOf(f, zone, next) === "out") {
        if (at >= 0) {
          visited.push(at);
        }
        at = next;
        target = goals[at]!;
        held = 0;
      }
    }
    const input =
      at < 0
        ? toward(f, zone, target, jump, ticks)
        : {
            ...toward(f, zone, target, jump, ticks),
            jumpHeld: held < 20 && (held++ === 0 || !zone.bird.grounded),
          };
    zone = step(f, zone, input);
    expect(zone.death).toBeUndefined();
  }
  return { ticks, visited, zone };
}

describe("awning row", () => {
  const row = MODULES["awning-row"]!;
  const awnings = row.objects.filter(({ character }) => character === AWNING);

  it("always holds one awning standable", () => {
    const plans = awnings.map(({ behaviour }) => behaviour as BehaviourPlan);
    const cycleTicks = Math.round(CYCLE_SECONDS / STEP_SECONDS);
    const states = plans.map((plan) => {
      const order: string[] = [];
      for (let key = plan.initial; order.length < 4;) {
        order.push(key);
        key = plan.states[key]!.transitions[0]!.to;
      }
      return Array.from({ length: cycleTicks }, (_, tick) => {
        let elapsed = tick * STEP_SECONDS;
        for (const key of order) {
          elapsed -= AWNING_SECONDS[key as keyof typeof AWNING_SECONDS];
          if (elapsed < -1e-9) {
            return key;
          }
        }
        return order[0]!;
      });
    });
    const standable = (plan: BehaviourPlan, key: string) =>
      plan.states[key]!.supportPhase !== "absent";
    for (let tick = 0; tick < cycleTicks; tick++) {
      expect(
        states.some((run, awning) => standable(plans[awning]!, run[tick]!)),
        `tick ${tick}`,
      ).toBe(true);
    }
  });

  it("crosses on awnings read out, from chunk entry, within the route budget", () => {
    const f = fixture();
    const { ticks, visited, zone } = cross(f, startZone(ordinary, f.layout, 1), ROUTE_TICKS);
    console.info(`${PAIR} route ticks`, ticks);
    expect(zone.cleared).toBe(true);
    expect(visited).toEqual([0, 1]);
    expect(ticks).toBeLessThanOrEqual(ROUTE_TICKS);
  });

  it("drops a missed crossing onto the lower street, whose step returns to the entry run", () => {
    const f = fixture();
    let zone = startZone(ordinary, f.layout, 1);
    const jump = { until: 0 };
    let tick = 0;
    // Wait on the entry run until the first awning retracts, then walk off its edge.
    for (; tick < ROUTE_TICKS && stateOf(f, zone, 0) !== "retracted"; tick++) {
      zone = step(f, zone, toward(f, zone, f.entryRight - ordinary.width, jump, tick));
    }
    for (; tick < 2 * ROUTE_TICKS && !(zone.bird.grounded && feet(zone) === f.lower); tick++) {
      zone = step(f, zone, { ...idle, move: 1 });
      expect(zone.death).toBeUndefined();
    }
    expect(feet(zone)).toBe(f.lower);
    // Back left over the step onto the entry run, then across.
    const entry = f.entryRight - ordinary.width - TILE;
    for (; tick < 3 * ROUTE_TICKS && !(zone.bird.grounded && feet(zone) === f.upper); tick++) {
      zone = step(f, zone, toward(f, zone, entry, jump, tick));
      expect(zone.death).toBeUndefined();
    }
    expect(feet(zone)).toBe(f.upper);
    expect(cross(f, zone, 2 * ROUTE_TICKS).zone.cleared).toBe(true);
  });

  it("collides only while out or warning", () => {
    const f = fixture();
    const object = f.area.objects[f.awnings[0]!]!;
    expect(
      Object.fromEntries(
        Object.keys(AWNING_SECONDS).map((stateKey) => [
          stateKey,
          effectiveCollision(object, { stateKey }),
        ]),
      ),
    ).toEqual({ extending: "none", out: "ledge", retracted: "none", warning: "ledge" });
  });

  it("never shares a chunk with an encounter, so no Kiwi yard relies on an awning", () => {
    const holds = (objects: readonly { character: string }[]) =>
      objects.some(({ character }) => character === AWNING);
    expect(Object.entries(CHUNKS).filter(([, chunk]) => holds(chunk.objects))).toEqual([]);
    for (const list of CERTIFIED_LISTS) {
      for (const { encounters, id, modules } of list.entries) {
        if (modules?.some((module) => holds(MODULES[module]!.objects))) {
          expect(encounters, id).toBe(0);
        }
      }
    }
  });
});
