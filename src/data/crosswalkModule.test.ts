import { describe, expect, it } from "vitest";

import { BIRD_FRAME } from "../assets";
import { STEP_SECONDS } from "../core";
import { SKILL_PROFILES } from "../progress";
import { effectiveHazardPhase } from "../rules/effectiveCollision";
import { composePair } from "../rules/modules";
import { phaseFollowerTag } from "../rules/phaseSource";
import { zoneLayout } from "../rules/tiles";
import { timedHazardRect } from "../rules/timedHazard";
import { startZone, stepZone, type ZoneInput, type ZoneState } from "../rules/zone";
import { CHUNK_LIBRARY } from "../rules/zonePlans";
import { CATALOGUE, HITBOXES, TILESETS } from "../testing/art";
import { chunkThemePlan } from "../testing/chunkWalkCases";
import { BIRD } from "./bird";
import { CERTIFIED_LISTS } from "./certified";
import { CHARACTERS } from "./characters";
import { MODULE_RULES, MODULES, PAIR_GRADES } from "./modules";
import { CROSSWALK_SECONDS } from "./obstacleBehaviours";
import { REACH } from "./reach";
import { TILE } from "./screen";
import { ZONE_FRAMES } from "./zoneFrames";

const ordinary = { ...BIRD, doubleJump: false };
delete ordinary.dash;
const idle = { jumpHeld: false, move: 0, useHeld: false } as const;
const CYCLE_SECONDS = Object.values(CROSSWALK_SECONDS).reduce((sum: number, s) => sum + s, 0);
const PAIR = "blue-city-planter--crosswalk";
// User-approved route-budget exception for the crosswalk over the ordinary 600 ticks: the route
// proof below measured this many ticks from chunk entry to the exit.
const CROSSWALK_ROUTE_TICKS = 731;

function fixture() {
  const { chunk } = composePair(
    { frame: ZONE_FRAMES.blue, grades: PAIR_GRADES, rules: MODULE_RULES, zone: "blue" },
    MODULES["city-planter"]!,
    MODULES.crosswalk!,
  );
  const plan = chunkThemePlan(
    { fills: { door: [], event: [] }, theme: "city-streets" },
    CHUNK_LIBRARY,
    chunk,
  );
  const layout = zoneLayout(TILE, BIRD_FRAME, CATALOGUE, HITBOXES, TILESETS, new Set(), plan);
  const area = layout.areas[layout.start.area]!;
  const strip = area.objects.findIndex(({ character }) => character === "crosswalk-strip");
  const signal = area.objects.findIndex(({ character }) => character === "crosswalk-signal");
  const object = area.objects[strip]!;
  return {
    area,
    chunk,
    layout,
    object,
    rect: timedHazardRect(object, object.origin),
    signal,
    strip,
  };
}

type Fixture = ReturnType<typeof fixture>;
const tagOf = (f: Fixture, zone: ZoneState) =>
  phaseFollowerTag(f.object, zone.behaviours[f.strip], f.area.objects[f.signal]!);
const overlapsStrip = ({ rect }: Fixture, zone: ZoneState) =>
  zone.bird.x < rect.x + rect.width &&
  zone.bird.x + ordinary.width > rect.x &&
  zone.bird.y + ordinary.height > rect.y;
const step = (f: Fixture, zone: ZoneState, input: ZoneInput) =>
  stepZone(SKILL_PROFILES, ordinary, f.layout, STEP_SECONDS, input, zone);
// Toward goal, jumping where the terrain ahead rises above his feet.
function toward(f: Fixture, zone: ZoneState, goal: number, jump: { until: number }, tick: number) {
  const move: ZoneInput["move"] =
    Math.abs(goal - zone.bird.x) <= 2 ? 0 : goal > zone.bird.x ? 1 : -1;
  const feet = zone.bird.y + ordinary.height;
  const ahead = move > 0 ? zone.bird.x + ordinary.width + TILE : zone.bird.x - TILE;
  const rising = f.chunk.solids.some(
    ({ col, cols, row }) =>
      move !== 0 &&
      row * TILE < feet - 1e-6 &&
      (move > 0
        ? col * TILE > zone.bird.x && col * TILE <= ahead
        : (col + cols) * TILE < zone.bird.x + ordinary.width && (col + cols) * TILE >= ahead),
  );
  if (zone.bird.grounded && rising && tick >= jump.until) {
    jump.until = tick + 8;
  }
  return { ...idle, jumpHeld: tick < jump.until, move };
}

describe("crosswalk module", () => {
  const crosswalk = MODULES.crosswalk!;
  const strip = crosswalk.objects.find(({ character }) => character === "crosswalk-strip")!;
  const cols = strip.cols ?? CHARACTERS["crosswalk-strip"]!.cols;

  it("lays its strip on the road between flat kerbs, too wide to jump", () => {
    const road = crosswalk.solids.find(({ col, cols: width }) => col === 0 && width === 30)!;
    expect(road.row).toBe(strip.row + 1);
    expect(cols).toBeGreaterThan(REACH.gap);
    expect(Math.min(strip.col, MODULE_RULES.cols - strip.col - cols)).toBeGreaterThanOrEqual(4);
  });

  it("leaves time to cross in walk and to finish from the middle in warning", () => {
    const speed = BIRD.walkSpeed / TILE;
    expect(CROSSWALK_SECONDS.inactive).toBeGreaterThanOrEqual((cols + 2 + REACH.hop) / speed);
    expect(CROSSWALK_SECONDS.warning).toBeGreaterThanOrEqual((cols / 2 + 2) / speed);
  });

  it("follows only the planter, a half with nothing timed or moving", () => {
    expect(MODULES["city-planter"]!.objects).toEqual([]);
    const grades = Object.values(MODULES)
      .filter(({ sides, zones }) => sides.includes("left") && zones.includes("blue"))
      .map(({ id }) => [id, PAIR_GRADES[`${id}--crosswalk`]]);
    expect(grades.filter(([, grade]) => grade !== 5)).toEqual([["city-planter", undefined]]);
    const blue = CERTIFIED_LISTS.find(({ zone }) => zone === "blue")!;
    const pairs = blue.entries.filter(({ modules }) => modules?.includes("crosswalk"));
    expect(pairs.filter(({ id }) => id !== PAIR)).toEqual([]);
  });

  it("waits on the near kerb for Walk, crosses without meeting traffic and exits", () => {
    const f = fixture();
    const kerb = f.rect.x - ordinary.width - TILE;
    const exitGoal = f.chunk.cols * TILE;
    const jump = { until: 0 };
    let zone = startZone(ordinary, f.layout, 1);
    let stage: "approach" | "wait" | "cross" = "approach";
    let sawStop = false;
    let previous = tagOf(f, zone);
    let tick = 0;
    for (; tick < 2 * CROSSWALK_ROUTE_TICKS + Math.ceil(CYCLE_SECONDS / STEP_SECONDS); tick++) {
      const tag = tagOf(f, zone);
      if (stage === "approach" && zone.bird.grounded && Math.abs(zone.bird.x - kerb) <= 2) {
        stage = "wait";
      }
      sawStop ||= stage === "wait" && tag === "stop";
      // Commit only on the observed change to Walk.
      if (stage === "wait" && sawStop && previous !== "walk" && tag === "walk") {
        stage = "cross";
      }
      previous = tag;
      zone = step(f, zone, toward(f, zone, stage === "cross" ? exitGoal : kerb, jump, tick));
      expect(zone.death, stage).toBeUndefined();
      if (overlapsStrip(f, zone)) {
        expect(effectiveHazardPhase(f.object, zone.behaviours[f.strip])).not.toBe("active");
      }
      if (zone.cleared) {
        break;
      }
    }
    console.info(`${PAIR} route ticks`, tick + 1);
    expect(zone.cleared).toBe(true);
    expect(tick + 1).toBeLessThanOrEqual(CROSSWALK_ROUTE_TICKS);
  });
});
