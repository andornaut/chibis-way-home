import { describe, expect, it } from "vitest";

import { ARCHETYPES } from "../data/archetypes";
import { BIRD } from "../data/bird";
import { CHARACTERS } from "../data/characters";
import { createOrbitHazardChunks } from "../data/orbitHazardChunks";
import { TILE, ZONE_ROWS } from "../data/screen";
import type { ZoneLayout } from "../data/types";
import { contactBox } from "../rules/behaviour";
import { birdBox } from "../rules/bird";
import { orbitPosition } from "../rules/orbit";
import { STEP_SECONDS } from "../rules/step";
import { sweptContact } from "../rules/sweptContact";
import { areaLayout } from "../rules/tiles";
import { standsOn, startZone, stepZone } from "../rules/zone";
import { TILESETS } from "../testing/walkSuite";
import { BIRD_FRAME } from "../view/bird";

const chunks = createOrbitHazardChunks("test");
function layoutOf(id: string): ZoneLayout {
  const chunk = chunks[id]!;
  return {
    areas: {
      main: areaLayout(
        TILE,
        { archetypes: ARCHETYPES, characters: CHARACTERS },
        {},
        TILESETS,
        new Set(),
        {
          cols: chunk.cols,
          entries: { start: { col: 2, row: chunk.entry.row } },
          objects: chunk.objects,
          rows: ZONE_ROWS,
          solids: chunk.solids,
        },
      ),
    },
    birdFrame: BIRD_FRAME,
    start: { area: "main", entry: "start" },
  };
}
const idle = { jumpHeld: false, move: 0, useHeld: false } as const;

describe.each(Object.keys(chunks))("orbital chunk %s", (id) => {
  it("completes the host cycle with both pauses and reversals while preserving the orbit clock", () => {
    const layout = layoutOf(id),
      area = layout.areas.main!,
      host = area.objects[0]!,
      child = area.objects[1]!;
    const cycle = 2 * (host.motion.distance / host.motion.speed + host.motion.pause);
    const ticks = Math.round(cycle / STEP_SECONDS);
    expect(ticks + 1).toBeLessThanOrEqual(id === "horizontal-platform-orbit" ? 1225 : 745);
    const axis = host.motion.direction === "up" ? "y" : "x";
    const positions: number[] = [];
    let zone = startZone(BIRD, layout, 1),
      prior = zone.objects[0]![axis];
    const directions = new Set<number>();
    let nearPause = 0,
      farPause = 0;
    const far = host.origin[axis] + (axis === "y" ? -host.motion.distance : host.motion.distance);
    for (let tick = 0; tick <= ticks; tick++) {
      zone = stepZone(BIRD, layout, STEP_SECONDS, idle, zone);
      expect(zone.death).toBeUndefined();
      const at = zone.objects[0]!,
        value = at[axis];
      const delta = value - prior;
      if (Math.abs(delta) > 1e-8) {
        directions.add(Math.sign(delta));
      } else if (Math.abs(value - host.origin[axis]) < 1e-8) {
        nearPause++;
      } else if (Math.abs(value - far) < 1e-8) {
        farPause++;
      }
      positions.push(value);
      const expected = orbitPosition(
        zone.seconds,
        { ...at, height: host.height, width: host.width },
        child.orbit!,
        child,
      );
      expect(zone.objects[1]!.x).toBeCloseTo(expected.x, 8);
      expect(zone.objects[1]!.y).toBeCloseTo(expected.y, 8);
      if (tick + 1 === ticks) {
        expect(value).toBeCloseTo(host.origin[axis], 8);
      }
      prior = value;
    }
    expect(directions).toEqual(new Set([-1, 1]));
    expect(nearPause).toBeGreaterThan(0);
    expect(farPause).toBeGreaterThan(0);
    expect(Math.min(...positions)).toBeCloseTo(Math.min(host.origin[axis], far), 8);
    expect(Math.max(...positions)).toBeCloseTo(Math.max(host.origin[axis], far), 8);
    expect(child.hitbox!.height).toBe(
      TILESETS["tiles-platforming"]!.hitboxes!["hazard-top"]!.height,
    );
  });

  it("boards, rides and transfers to the far dock before clearing", () => {
    const layout = layoutOf(id),
      area = layout.areas.main!,
      host = area.objects[0]!;
    const vertical = host.motion.direction === "up";
    let zone = startZone(BIRD, layout, 1),
      phase = "approach",
      jumpAt = -Infinity,
      boarded = false,
      carried = 0,
      docked = false;
    const trace: unknown[] = [];
    for (let tick = 0; tick < (vertical ? 1200 : 600) && !zone.cleared && !zone.death; tick++) {
      const at = zone.objects[0]!;
      const on = standsOn(BIRD, zone.bird, { ...at, height: host.height, width: host.width });
      let move: -1 | 0 | 1 = 0;
      if (phase === "approach") {
        move = 1;
        if (zone.bird.grounded && zone.bird.x >= (vertical ? 80 : 96)) {
          phase = vertical ? "step" : "board";
          jumpAt = tick;
        }
      }
      if (phase === "step") {
        move = zone.bird.x < 224 ? 1 : 0;
        if (zone.bird.grounded && zone.bird.y + BIRD.height === 45 * TILE) {
          phase = "wait";
        }
      }
      if (phase === "wait") {
        move = zone.bird.x < 224 ? 1 : 0;
      }
      if (
        phase === "wait" &&
        at.y >= 450 &&
        zone.seconds > host.motion.distance / host.motion.speed + host.motion.pause
      ) {
        phase = "board";
        jumpAt = tick;
      }
      if (phase === "board") {
        move = zone.bird.x < at.x + (host.width - BIRD.width) / 2 ? 1 : 0;
        if (on) {
          phase = "ride";
          boarded = true;
        }
      }
      if (phase === "ride" && (vertical ? at.y <= 414 : at.x >= 367)) {
        phase = "exit";
        jumpAt = tick;
      }
      if (phase === "exit") {
        move = 1;
      }
      const before = zone.bird;
      zone = stepZone(
        BIRD,
        layout,
        STEP_SECONDS,
        {
          jumpHeld: tick - jumpAt < Math.ceil(BIRD.jumpRiseTime / STEP_SECONDS) + 1,
          move,
          useHeld: false,
        },
        zone,
      );
      if (on && phase === "ride") {
        carried += Math.hypot(zone.bird.x - before.x, zone.bird.y - before.y);
      }
      const farDock = area.solids.at(-1)!;
      docked ||=
        zone.bird.grounded &&
        zone.bird.y + BIRD.height === farDock.y &&
        zone.bird.x + BIRD.width > farDock.x;
      if (tick % 60 === 0 || zone.death) {
        trace.push({ bird: zone.bird, death: zone.death, host: at, phase, tick });
      }
    }
    expect(zone.death, JSON.stringify(trace)).toBeUndefined();
    expect(zone.cleared, JSON.stringify({ bird: zone.bird, boarded, carried, phase, trace })).toBe(
      true,
    );
    expect(boarded).toBe(true);
    expect(docked).toBe(true);
    expect(carried).toBeGreaterThan(host.width);
  });
});

it("attributes a four-pixel orbital arc contact that the endpoint chord misses", () => {
  const base = layoutOf("horizontal-platform-orbit");
  const layout = {
    ...base,
    areas: { main: { ...base.areas.main!, entries: { start: { x: 219, y: 522 } } } },
  };
  const initial = startZone(BIRD, layout, 1),
    child = layout.areas.main!.objects[1]!;
  const caught = stepZone(BIRD, layout, 0.5, idle, initial);
  expect(
    sweptContact(
      birdBox(BIRD, initial.bird),
      caught.bird,
      contactBox(child, initial.objects[1]!, 1),
      contactBox(child, caught.objects[1]!, 1),
    ),
  ).toBe(false);
  expect(caught.death?.reason).toBe("hazard");
  expect(caught.death?.contact).toEqual({ contactCue: "red-hazard", index: 1, kind: "object" });
});
