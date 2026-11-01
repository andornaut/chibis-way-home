import { describe, expect, it } from "vitest";

import { BIRD } from "../data/bird";
import type { Archetype, AreaPlan, Instance, ObjectLayout, Rect, ZoneLayout } from "../data/types";
import { BIRD_FRAME } from "../view/bird";
import { motionTrack } from "./motion";
import {
  namespaceOrbitInstances,
  orbitBounds,
  orbitHostLegs,
  orbitPosition,
  orbitSweptContact,
  validateOrbitReferences,
} from "./orbit";
import { sweptContact } from "./sweptContact";
import { areaLayout } from "./tiles";
import { retryZone, startZone, stepZone } from "./zone";

const base: Archetype = {
  collision: "ledge",
  interaction: { kind: "none", range: 0 },
  motion: {
    algorithm: "linear",
    direction: "right",
    distance: 18,
    hopHeight: 0,
    pause: 1,
    speed: 6,
    variance: 0,
  },
  reaction: { kind: "none", range: 0, speed: 0 },
};
const catalogue = {
  archetypes: {
    hazard: {
      ...base,
      collision: "hazard" as const,
      motion: { ...base.motion, algorithm: "static" as const },
    },
    platform: base,
  },
  characters: {
    hazard: { archetype: "hazard", art: "hazard", cols: 1, rows: 1 },
    platform: { archetype: "platform", art: "platform", cols: 6, rows: 1 },
  },
};
const host: Instance = { character: "platform", col: 18, id: "lift", row: 40 };
const child: Instance = {
  character: "hazard",
  col: 26.5,
  id: "edge",
  orbit: { angularSpeed: 1, host: "lift", phase: 0, radius: 6 },
  row: 40,
};
const plan = (objects: readonly Instance[] = [host, child]): AreaPlan => ({
  cols: 60,
  entries: { start: { col: 5, row: 50 } },
  objects,
  rows: 60,
  solids: [{ col: 0, cols: 60, row: 50, rows: 10 }],
});
const resolve = (objects: readonly Instance[] = [host, child]) =>
  areaLayout(12, catalogue, {}, {}, new Set(), plan(objects));
const layout = (objects: readonly Instance[] = [host, child]): ZoneLayout => ({
  areas: { main: resolve(objects) },
  birdFrame: BIRD_FRAME,
  start: { area: "main", entry: "start" },
});
const idle = { jumpHeld: false, move: 0, useHeld: false } as const;

function pair(): readonly [ObjectLayout, ObjectLayout] {
  const objects = areaLayout(1, catalogue, {}, {}, new Set(), plan()).objects;
  return [objects[0]!, objects[1]!];
}

describe("instance-local orbit relationships", () => {
  it("resolves references after filtering and validates the nominal authored reference pose", () => {
    const area = resolve([{ ...host, phase: 0.5 }, child]);
    expect(area.objects[1]!.orbit).toEqual({ angularSpeed: 1, host: 0, phase: 0, radius: 72 });
    expect(() => resolve([host, { ...child, col: child.col + 1 }])).toThrow("reference pose");
    const stage = layout([{ ...host, phase: 0.5 }, child]);
    const zone = startZone(BIRD, stage, 1);
    expect(zone.objects[1]!.x - area.objects[1]!.origin.x).toBe(18 * 12);
    expect(() => resolve([{ ...host, requires: ["absent"] }, child])).toThrow("Missing orbit host");
  });
  it.each([
    { label: "empty id", objects: [{ ...host, id: "" }] },
    { label: "duplicate id", objects: [host, { ...child, id: "lift" }] },
    { label: "missing host", objects: [child] },
    { label: "self", objects: [{ ...child, id: "lift" }] },
    { label: "cycle", objects: [{ ...host, orbit: { ...child.orbit!, host: "edge" } }, child] },
    {
      label: "invalid radius",
      objects: [host, { ...child, orbit: { ...child.orbit!, radius: 0 } }],
    },
  ])("rejects $label", ({ objects }) => expect(() => validateOrbitReferences(objects)).toThrow());
  it.each(["ease", "wander"] as const)(
    "rejects unsupported %s hosts without changing independent objects",
    (algorithm) => {
      const changed = { ...host, overrides: { motion: { algorithm } } };
      expect(() => resolve([changed])).not.toThrow();
      expect(() => resolve([changed, child])).toThrow("Unsupported orbit host");
    },
  );
  it("namespaces repeated placements and rejects references to a different chunk", () => {
    const one = namespaceOrbitInstances("one", [host, child]);
    const two = namespaceOrbitInstances("two", [host, child]).map((instance) => ({
      ...instance,
      col: instance.col + 60,
    }));
    const area = areaLayout(1, catalogue, {}, {}, new Set(), {
      ...plan([...one, ...two]),
      cols: 120,
    });
    expect(area.objects.filter(({ orbit }) => orbit).map(({ orbit }) => orbit!.host)).toEqual([
      0, 2,
    ]);
    expect(() =>
      namespaceOrbitInstances("bad", [{ ...child, orbit: { ...child.orbit!, host: "one/lift" } }]),
    ).toThrow("Missing orbit host");
  });
  it("follows actual same-tick host positions independently of array order and resets on retry", () => {
    for (const objects of [
      [host, child],
      [child, host],
    ]) {
      const stage = layout(objects);
      const start = startZone(BIRD, stage, 1);
      const stepped = stepZone(BIRD, stage, 0.5, idle, start);
      const area = stage.areas.main!;
      const index = area.objects.findIndex(({ orbit }) => orbit);
      const follower = area.objects[index]!;
      const parent = area.objects[follower.orbit!.host]!;
      expect(stepped.objects[index]).toEqual(
        orbitPosition(
          stepped.seconds,
          { ...stepped.objects[follower.orbit!.host]!, height: parent.height, width: parent.width },
          follower.orbit!,
          follower,
        ),
      );
      const retry = retryZone(BIRD, stage, {
        ...stepped,
        death: {
          position: stepped.bird,
          reason: "hazard",
          support: undefined,
          velocity: { x: 0, y: 0 },
        },
      });
      expect(retry.seconds).toBe(0);
      expect(retry.objects).toEqual(start.objects);
    }
  });
  it("resolves a vertical host and validates its complete orbital footprint", () => {
    const vertical = {
      ...host,
      col: 27,
      overrides: { motion: { direction: "up" as const, distance: 10 } },
      row: 42,
    };
    const follower = { ...child, col: 35.5, row: 42 };
    const area = areaLayout(1, catalogue, {}, {}, new Set(), plan([vertical, follower]));
    expect(orbitBounds(area.objects, area.objects[1]!)).toEqual({
      height: 23,
      width: 13,
      x: 23.5,
      y: 26,
    });
    const stage = layout([follower, vertical]);
    const zone = stepZone(BIRD, stage, 0.5, idle, startZone(BIRD, stage, 1));
    expect(zone.objects[1]!.y).toBeLessThan(stage.areas.main!.objects[1]!.origin.y);
    expect(zone.objects[0]).toEqual(
      orbitPosition(
        zone.seconds,
        { ...zone.objects[1]!, height: 12, width: 72 },
        stage.areas.main!.objects[0]!.orbit!,
        stage.areas.main!.objects[0]!,
      ),
    );
  });
  it("covers the complete moving-host arc and splits real turn/pause legs", () => {
    const [parent, follower] = pair();
    expect(orbitBounds([parent, follower], follower)).toEqual({
      height: 13,
      width: 31,
      x: 14.5,
      y: 34,
    });
    const track = motionTrack(parent.motion, parent.phase, () => 0.5);
    const point = (time: number) => ({
      x: parent.origin.x + track.at(time).x,
      y: parent.origin.y + track.at(time).y,
    });
    const legs = orbitHostLegs(0, 8, parent, track, point(0), point(8));
    expect(legs.map(({ end, start }) => [start, end])).toEqual([
      [0, 3],
      [3, 4],
      [4, 7],
      [7, 8],
    ]);
    expect(legs[1]!.from).toEqual(legs[1]!.to);
    expect(legs[3]!.from).toEqual(legs[3]!.to);
  });
});

describe("continuous orbital contact", () => {
  it("catches the curved arc and rejects a chord-only hit", () => {
    const [originalHost, original] = pair();
    const parent = { ...originalHost, origin: { x: -3, y: -0.5 } };
    const follower = { ...original, orbit: { ...original.orbit!, radius: 10 } };
    const leg = { end: Math.PI, from: parent.origin, start: 0, to: parent.origin };
    const arc: Rect = { height: 1, width: 1, x: -0.5, y: 9.5 };
    const chord = { ...arc, y: -0.5 };
    const start = orbitPosition(
      0,
      { ...parent.origin, height: parent.height, width: parent.width },
      follower.orbit,
      follower,
    );
    const end = orbitPosition(
      Math.PI,
      { ...parent.origin, height: parent.height, width: parent.width },
      follower.orbit,
      follower,
    );
    expect(
      sweptContact({ ...start, height: follower.height, width: follower.width }, end, arc, arc),
    ).toBe(false);
    expect(orbitSweptContact(follower, parent, leg, arc, arc)).toBe(true);
    expect(
      sweptContact({ ...start, height: follower.height, width: follower.width }, end, chord, chord),
    ).toBe(true);
    expect(orbitSweptContact(follower, parent, leg, chord, chord)).toBe(false);
  });
  it("uses the continuous arc in the real zone engine rather than the endpoint chord", () => {
    const [originalHost, original] = pair();
    const parent: ObjectLayout = {
      ...originalHost,
      motion: { ...originalHost.motion, distance: 1, pause: 0, speed: 1 / Math.PI },
      origin: { x: -3, y: -0.5 },
    };
    const orbit = { ...original.orbit!, radius: 10 };
    const follower = {
      ...original,
      orbit,
      origin: orbitPosition(
        0,
        { ...parent.origin, height: parent.height, width: parent.width },
        orbit,
        original,
      ),
    };
    const tuning = { ...BIRD, flutterFallSpeed: 0, gravity: 0, height: 1, width: 1 };
    const stage = (x: number, y: number): ZoneLayout => ({
      areas: {
        main: {
          backX: -100,
          chunks: [],
          entries: { start: { x: x + tuning.width / 2, y: y + tuning.height } },
          exitX: 190,
          height: 200,
          objects: [parent, follower],
          solids: [],
          terrain: [],
          tileset: undefined,
          width: 200,
        },
      },
      birdFrame: BIRD_FRAME,
      start: { area: "main", entry: "start" },
    });
    const curved = stage(0, 9.5);
    const caught = stepZone(tuning, curved, Math.PI, idle, startZone(tuning, curved, 1));
    expect(caught.death?.reason).toBe("hazard");
    const chord = stage(0, -0.5);
    expect(
      stepZone(tuning, chord, Math.PI, idle, startZone(tuning, chord, 1)).death,
    ).toBeUndefined();
  });
  it("uses the actual red hitbox offset and preserves clear body space", () => {
    const [parent, original] = pair();
    const follower = {
      ...original,
      height: 4,
      hitbox: { height: 1, width: 4, x: 0, y: 3 },
      orbit: { ...original.orbit!, angularSpeed: 0 },
      width: 4,
    };
    const at = orbitPosition(
      0,
      { ...parent.origin, height: parent.height, width: parent.width },
      follower.orbit,
      follower,
    );
    const leg = { end: 1, from: parent.origin, start: 0, to: parent.origin };
    const clear = { height: 0.5, width: 0.5, x: at.x + 1, y: at.y + 1 };
    const red = { ...clear, y: at.y + 3 };
    expect(orbitSweptContact(follower, parent, leg, clear, clear)).toBe(false);
    expect(orbitSweptContact(follower, parent, leg, red, red)).toBe(true);
  });
});
