import { readFileSync } from "node:fs";

import { expect, it } from "vitest";

import { BIRD_FRAME } from "../assets/index.ts";
import { STEP_SECONDS } from "../core/index.ts";
import { crumblingAppearance, crumblingSkinTiles } from "../presentation/index.ts";
import { SKILL_PROFILES } from "../progress/index.ts";
import { zonePlanOf } from "../rules/assemble.ts";
import { zoneLayout } from "../rules/tiles.ts";
import { retryZone, startZone, stepZone, type ZoneInput, type ZoneState } from "../rules/zone.ts";
import { CHUNK_LIBRARY } from "../rules/zonePlans.ts";
import type { Tileset } from "../stage/index.ts";
import { CATALOGUE, HITBOXES, TILESETS } from "../testing/walkSuite.ts";
import { BIRD } from "./bird.ts";
import { CHUNKS } from "./chunks.ts";
import { CRUMBLING_SUPPORT_TUNING } from "./obstacleTuning.ts";
import { TILE } from "./screen.ts";
import type { ObjectLayout } from "./types/index.ts";

const ordinary = { ...BIRD, doubleJump: false };
delete ordinary.dash;
const idle = { jumpHeld: false, move: 0, useHeld: false } as const;
const CYCLE = CRUMBLING_SUPPORT_TUNING.warningSeconds + CRUMBLING_SUPPORT_TUNING.absentSeconds;
const TICK_LIMIT = Math.ceil((4 * CYCLE) / STEP_SECONDS);

function fixture() {
  const plan = zonePlanOf(CHUNK_LIBRARY, () => 0, { door: [], event: [] }, "city-streets", 2, [
    "crumbling-support-crossing",
  ]);
  const layout = zoneLayout(TILE, BIRD_FRAME, CATALOGUE, HITBOXES, TILESETS, new Set(), plan);
  const area = layout.areas[layout.start.area]!;
  expect(area.crumbling).toHaveLength(1);
  const definition = area.crumbling![0]!;
  const ledge = definition.supportId as ObjectLayout;
  expect(area.objects).toContain(ledge);
  expect(definition.profile).toEqual(CRUMBLING_SUPPORT_TUNING);
  const chunk = CHUNKS["crumbling-support-crossing"]!;
  const [left, , right] = chunk.solids.map(({ col, cols, row }) => ({
    left: col * TILE,
    right: (col + cols) * TILE,
    y: row * TILE,
  }));
  const key = ledge.tileset ?? area.tileset!;
  const tileset = JSON.parse(
    readFileSync(new URL(`../../public/art/tilesets/${key}.json`, import.meta.url), "utf8"),
  ) as Tileset;
  // The real ledge resolves to its dedicated skins at load.
  const skins = crumblingSkinTiles(tileset, ledge);
  expect(skins.warning).toHaveLength(ledge.width / TILE);
  return { area, banks: { left: left!, right: right! }, definition, layout, ledge };
}

type Fixture = ReturnType<typeof fixture>;
const phaseOf = (zone: ZoneState) => zone.crumbling!.supports[0]!.phase;
const feetOn = (zone: ZoneState, y: number) =>
  zone.bird.grounded && Math.abs(zone.bird.y + ordinary.height - y) < 1e-6;
const onLedge = ({ ledge }: Fixture, zone: ZoneState) =>
  feetOn(zone, ledge.origin.y) &&
  zone.bird.x < ledge.origin.x + ledge.width &&
  zone.bird.x + ordinary.width > ledge.origin.x;

// Runs right and takes off with a full held jump at the right edge of each support.
function input(f: Fixture, zone: ZoneState, hold: { until: number }, tick: number): ZoneInput {
  const edge = onLedge(f, zone)
    ? f.ledge.origin.x + f.ledge.width
    : feetOn(zone, f.banks.left.y) && zone.bird.x < f.banks.left.right
      ? f.banks.left.right
      : Infinity;
  if (zone.bird.grounded && zone.bird.x + ordinary.width >= edge - 2 && tick >= hold.until) {
    hold.until = tick + Math.ceil(ordinary.jumpRiseTime / STEP_SECONDS);
  }
  return { ...idle, jumpHeld: tick < hold.until, move: 1 };
}

it("crumbling support warns on landing, gives an ordinary jump to the far bank, then restores", () => {
  const f = fixture();
  const hold = { until: 0 };
  let zone = startZone(ordinary, f.layout, 1);
  let landed: number | undefined;
  let warnedAt: number | undefined;
  let takeoff: number | undefined;
  let banked: number | undefined;
  let removedAt: number | undefined;
  let restoredAt: number | undefined;
  for (let tick = 0; tick < TICK_LIMIT; tick++) {
    const before = zone;
    // Chibi waits on the far bank through removal and restoration before leaving.
    const waiting = banked !== undefined && restoredAt === undefined;
    zone = stepZone(
      SKILL_PROFILES,
      ordinary,
      f.layout,
      STEP_SECONDS,
      waiting ? idle : input(f, zone, hold, tick),
      zone,
    );
    expect(zone.death, JSON.stringify(zone.bird)).toBeUndefined();
    const phase = phaseOf(zone);
    if (landed === undefined && onLedge(f, zone)) {
      landed = zone.seconds;
      // The contact queues at this tick's end; the warning begins at the next boundary.
      expect(phase.kind).toBe("intact");
      expect(zone.crumbling!.pendingContacts).toEqual([{ actorId: "chibi", supportId: f.ledge }]);
    }
    if (warnedAt === undefined && phase.kind === "warning") {
      warnedAt = zone.crumbling!.begunAtSeconds!;
      expect(warnedAt).toBeCloseTo(landed!, 9);
      expect(phase.removeAtSeconds).toBeCloseTo(
        warnedAt + CRUMBLING_SUPPORT_TUNING.warningSeconds,
        9,
      );
      expect(crumblingAppearance(phase)).toBe("warning");
    }
    if (takeoff === undefined && onLedge(f, before) && !zone.bird.grounded) {
      takeoff = before.seconds;
      expect(phase.kind).toBe("warning");
    }
    if (banked === undefined && takeoff !== undefined && feetOn(zone, f.banks.right.y)) {
      banked = zone.seconds;
      expect(zone.bird.x).toBeGreaterThanOrEqual(f.banks.right.left - ordinary.width);
    }
    if (removedAt === undefined && phase.kind === "absent") {
      removedAt = zone.crumbling!.begunAtSeconds!;
      expect(removedAt + 1e-9).toBeGreaterThanOrEqual(
        warnedAt! + CRUMBLING_SUPPORT_TUNING.warningSeconds,
      );
      expect(removedAt).toBeLessThan(
        warnedAt! + CRUMBLING_SUPPORT_TUNING.warningSeconds + STEP_SECONDS,
      );
      expect(crumblingAppearance(phase)).toBeUndefined();
    }
    if (removedAt !== undefined && restoredAt === undefined && phase.kind === "intact") {
      restoredAt = zone.crumbling!.begunAtSeconds!;
      // Restoration takes the first clear boundary at or after the absent deadline.
      expect(restoredAt + 1e-9).toBeGreaterThanOrEqual(
        removedAt + CRUMBLING_SUPPORT_TUNING.absentSeconds,
      );
      expect(restoredAt).toBeLessThan(
        removedAt + CRUMBLING_SUPPORT_TUNING.absentSeconds + STEP_SECONDS + 1e-9,
      );
      expect(zone.crumbling!.pendingContacts).toEqual([]);
    }
    if (zone.cleared) {
      break;
    }
  }
  expect(zone.cleared).toBe(true);
  expect({ banked, landed, removedAt, restoredAt, takeoff, warnedAt }).toMatchObject({
    banked: expect.any(Number),
    removedAt: expect.any(Number),
    restoredAt: expect.any(Number),
  });
  expect(takeoff! - warnedAt!).toBeLessThan(CRUMBLING_SUPPORT_TUNING.warningSeconds);
});

it("crumbling support drops a waiting Chibi into the pit and Retry restores it intact", () => {
  const f = fixture();
  const hold = { until: 0 };
  let zone = startZone(ordinary, f.layout, 1);
  let sawAbsent = false;
  for (let tick = 0; tick < TICK_LIMIT && zone.death === undefined; tick++) {
    const waiting = onLedge(f, zone);
    zone = stepZone(
      SKILL_PROFILES,
      ordinary,
      f.layout,
      STEP_SECONDS,
      waiting ? idle : input(f, zone, hold, tick),
      zone,
    );
    sawAbsent ||= phaseOf(zone).kind === "absent";
  }
  expect(sawAbsent).toBe(true);
  expect(zone.death).toBeDefined();
  expect(phaseOf(zone).kind).toBe("absent");
  const retried = retryZone(ordinary, f.layout, zone);
  expect(retried.death).toBeUndefined();
  expect(retried.attempt).toBe(zone.attempt + 1);
  expect(retried.crumbling).toEqual({
    begunAtSeconds: null,
    pendingContacts: [],
    standingContacts: [],
    supports: [{ phase: { kind: "intact" }, supportId: f.ledge }],
  });
});
