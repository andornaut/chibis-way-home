import { describe, expect, it } from "vitest";

import { BIRD_FRAME } from "../assets";
import { STEP_SECONDS } from "../core";
import { BIRD } from "../data/bird";
import { TILE } from "../data/screen";
import type { Rect } from "../data/types";
import { zonePlanOf } from "../rules/assemble";
import { zoneLayout } from "../rules/tiles";
import { standsOn, startZone, stepZone, type ZoneState } from "../rules/zone";
import { CHUNK_LIBRARY } from "../rules/zonePlans";
import { CATALOGUE, HITBOXES, TILESETS } from "../testing/walkSuite";

const ids = [
  "city-boundary-shuttle",
  "compound-lift-shuttle",
  "compound-low-ceiling-shuttle",
  "compound-return-shuttle",
];
function crossing(id: string) {
  const plan = zonePlanOf(CHUNK_LIBRARY, () => 0, { door: [], event: [] }, "street", 2, [id]);
  const layout = zoneLayout(TILE, BIRD_FRAME, CATALOGUE, HITBOXES, TILESETS, new Set(), plan);
  const area = layout.areas[layout.start.area]!;
  const index = area.objects.findIndex(
    (object) =>
      object.collision === "ledge" &&
      (object.behaviour?.axis === "x" || object.motion.algorithm === "linear"),
  );
  const object = area.objects[index]!;
  const near = area.solids
    .filter((solid) => solid.x + solid.width <= object.origin.x)
    .sort((a, b) => b.x + b.width - a.x - a.width)[0]!;
  const far = area.solids
    .filter(
      (solid) =>
        solid.x >=
        object.origin.x + (object.behaviour?.distance ?? object.motion.distance) + object.width,
    )
    .sort((a, b) => a.x - b.x)[0]!;
  return { area, far, index, layout, near, object };
}
function standing(zone: ZoneState, bank: Rect, vx = 0): ZoneState {
  return {
    ...zone,
    bird: {
      ...zone.bird,
      coyoteLeft: BIRD.coyoteTime,
      grounded: true,
      vx,
      vy: 0,
      x: bank.x + bank.width - 3 * TILE,
      y: bank.y - BIRD.height,
    },
  };
}
const idle = { jumpHeld: false, move: 0, useHeld: false } as const;

function noOrdinaryBypass(id: string): void {
  const { far, layout, near } = crossing(id);
  const areaId = layout.start.area;
  // Isolate the authored banks from all object assistance and contact hazards.
  const banks = {
    ...layout,
    areas: { ...layout.areas, [areaId]: { ...layout.areas[areaId]!, objects: [] } },
  };
  let zone = standing(startZone(BIRD, banks, 1), near, BIRD.walkSpeed);
  let jumped = false;
  let furthest = zone.bird.x + BIRD.width;
  for (let tick = 0; tick < 600 && !zone.death && !zone.cleared; tick++) {
    jumped ||=
      !zone.bird.grounded && zone.bird.coyoteLeft > 0 && zone.bird.coyoteLeft <= 2 * STEP_SECONDS;
    zone = stepZone(BIRD, banks, STEP_SECONDS, { jumpHeld: jumped, move: 1, useHeld: false }, zone);
    if (zone.bird.y + BIRD.height <= far.y) {
      furthest = Math.max(furthest, zone.bird.x + BIRD.width);
    }
    if (zone.bird.grounded && zone.bird.x + BIRD.width > far.x) {
      break;
    }
  }
  expect(jumped).toBe(true);
  expect(furthest).toBeLessThan(far.x);
  expect(zone.cleared).toBe(false);
}

it("does not let an ordinary jump bypass the shortened orbital crossing", () =>
  noOrdinaryBypass("horizontal-platform-orbit"));

describe.each(ids)("short horizontal crossing %s", (id) => {
  it("does not let a full ordinary running coyote jump bypass the platform", () =>
    noOrdinaryBypass(id));
  it("boards, rides and jumps onto the actual far bank without dash", () => {
    const { far, index, layout, near, object } = crossing(id);
    let zone = standing(startZone(BIRD, layout, 1), near);
    let phase: "board" | "ride" | "exit" = "board";
    let jumpAt = 0;
    let carried = 0;
    let docked = false;
    const trace: unknown[] = [];
    let ticks = 0;
    for (; ticks < 600 && !zone.death && !docked; ticks++) {
      const at = zone.objects[index]!;
      const on = standsOn(BIRD, zone.bird, { ...at, height: object.height, width: object.width });
      if (phase === "board" && on) {
        phase = "ride";
      }
      if (phase === "ride" && at.x >= object.origin.x + object.behaviour!.distance - TILE) {
        phase = "exit";
        jumpAt = ticks;
      }
      const target = phase === "board" ? at.x + (object.width - BIRD.width) / 2 : far.x + 2 * TILE;
      const hold =
        phase === "board" && id === "compound-low-ceiling-shuttle"
          ? BIRD.jumpTapWindow / 2
          : BIRD.jumpRiseTime;
      const before = zone.bird.x;
      zone = stepZone(
        BIRD,
        layout,
        STEP_SECONDS,
        {
          jumpHeld: phase !== "ride" && (ticks - jumpAt) * STEP_SECONDS < hold,
          move: phase === "ride" ? 0 : zone.bird.x < target ? 1 : 0,
          useHeld: false,
        },
        zone,
      );
      if (on && phase === "ride") {
        carried += zone.bird.x - before;
      }
      docked =
        zone.bird.grounded &&
        Math.abs(zone.bird.y + BIRD.height - far.y) < 0.01 &&
        zone.bird.x + BIRD.width > far.x;
      if (ticks % 60 === 0 || zone.death) {
        trace.push({ bird: zone.bird, death: zone.death, host: at, phase, ticks });
      }
    }
    expect(zone.death, JSON.stringify(trace)).toBeUndefined();
    expect(docked, JSON.stringify(trace)).toBe(true);
    expect(phase).toBe("exit");
    expect(carried).toBeGreaterThan(0);
    console.info(`${id}: board/ride/dock ${ticks} ticks`);
  });
  it("reaches both horizontal endpoints, pauses and returns within the bounded full cycle", () => {
    const { index, layout, object } = crossing(id);
    const graph = object.behaviour!;
    const motion = graph.states.forward!.motion;
    if (motion.kind !== "move") {
      throw new Error("Expected shuttle movement");
    }
    const condition = graph.states["wait-near"]!.transitions[0]!.when[0]!;
    if (condition.kind !== "elapsed") {
      throw new Error("Expected shuttle pause");
    }
    const ticks = Math.ceil(
      (2 * (graph.distance / motion.speed + condition.seconds)) / STEP_SECONDS,
    );
    expect(ticks).toBeLessThanOrEqual(900);
    let zone = startZone(BIRD, layout, 1);
    const xs: number[] = [];
    const directions = new Set<number>();
    let pausedNear = false,
      pausedFar = false;
    let previous = zone.objects[index]!.x;
    for (let tick = 0; tick < ticks; tick++) {
      zone = stepZone(BIRD, layout, STEP_SECONDS, idle, zone);
      expect(zone.death).toBeUndefined();
      const x = zone.objects[index]!.x;
      xs.push(x);
      if (Math.abs(x - previous) > 1e-8) {
        directions.add(Math.sign(x - previous));
      } else {
        pausedNear ||= Math.abs(x - object.origin.x) < 1e-8;
        pausedFar ||= Math.abs(x - object.origin.x - graph.distance) < 1e-8;
      }
      previous = x;
    }
    expect(directions).toEqual(new Set([-1, 1]));
    expect(pausedNear && pausedFar).toBe(true);
    expect(Math.min(...xs)).toBeCloseTo(object.origin.x);
    expect(Math.max(...xs)).toBeCloseTo(object.origin.x + graph.distance);
    expect(zone.objects[index]!.x).toBeCloseTo(object.origin.x);
    console.info(`${id}: full cycle ${ticks} ticks`);
  });
});
