import { expect, it } from "vitest";

import { BIRD_FRAME } from "../assets";
import { STEP_SECONDS } from "../core";
import { SKILL_PROFILES } from "../progress";
import { zonePlanOf } from "../rules/assemble";
import { effectiveCollision, effectiveHazardPhase } from "../rules/effectiveCollision";
import { zoneLayout } from "../rules/tiles";
import { timedHazardRect } from "../rules/timedHazard";
import { retryZone, startZone, stepZone, type ZoneInput, type ZoneState } from "../rules/zone";
import { CHUNK_LIBRARY } from "../rules/zonePlans";
import { CATALOGUE, HITBOXES, TILESETS } from "../testing/walkSuite";
import { BIRD } from "./bird";
import { CHUNKS } from "./chunks";
import { WARNED_VENT_SECONDS } from "./obstacleBehaviours";
import { TILE } from "./screen";

const ordinary = { ...BIRD, doubleJump: false };
delete ordinary.dash;
const idle = { jumpHeld: false, move: 0, useHeld: false } as const;
const CYCLE_SECONDS = Object.values(WARNED_VENT_SECONDS).reduce(
  (sum: number, seconds) => sum + seconds,
  0,
);
const TICK_LIMIT = Math.ceil((4 * CYCLE_SECONDS) / STEP_SECONDS);

function fixture() {
  const plan = zonePlanOf(CHUNK_LIBRARY, () => 0, { door: [], event: [] }, "city-streets", 2, [
    "warned-vent-terrace",
  ]);
  const layout = zoneLayout(TILE, BIRD_FRAME, CATALOGUE, HITBOXES, TILESETS, new Set(), plan);
  const area = layout.areas[layout.start.area]!;
  const vent = area.objects.findIndex(({ character }) => character === "warned-vent");
  const object = area.objects[vent]!;
  const rect = timedHazardRect(object, object.origin);
  const chunk = CHUNKS["warned-vent-terrace"]!;
  const deck = chunk.solids.find(
    ({ col, cols }) => col * TILE <= rect.x && (col + cols) * TILE >= rect.x + rect.width,
  )!;
  const refuges = {
    left: { max: rect.x - ordinary.width, min: deck.col * TILE },
    right: { max: (deck.col + deck.cols) * TILE - ordinary.width, min: rect.x + rect.width },
  };
  return { deckY: deck.row * TILE, layout, object, rect, refuges, vent };
}

type Fixture = ReturnType<typeof fixture>;
const phaseOf = ({ object, vent }: Fixture, zone: ZoneState) =>
  effectiveHazardPhase(object, zone.behaviours[vent]);
const overlapsVent = ({ rect }: Fixture, zone: ZoneState) =>
  zone.bird.x < rect.x + rect.width && zone.bird.x + ordinary.width > rect.x;
const onDeck = ({ deckY }: Fixture, zone: ZoneState, range: { max: number; min: number }) =>
  zone.bird.grounded &&
  Math.abs(zone.bird.y + ordinary.height - deckY) < 1e-6 &&
  zone.bird.x >= range.min - 1e-6 &&
  zone.bird.x <= range.max + 1e-6;

// Walks right and jumps at each rising floor edge until Chibi stands at the goal.
function input(
  f: Fixture,
  zone: ZoneState,
  goal: number,
  jumpUntil: { tick: number },
  tick: number,
): ZoneInput {
  const move: ZoneInput["move"] =
    Math.abs(goal - zone.bird.x) <= 2 ? 0 : goal > zone.bird.x ? 1 : -1;
  const ahead = zone.bird.x + ordinary.width + TILE;
  const rising = CHUNKS["warned-vent-terrace"]!.solids.some(
    ({ col, row }) =>
      move > 0 &&
      row * TILE < zone.bird.y + ordinary.height - 1e-6 &&
      col * TILE > zone.bird.x &&
      col * TILE <= ahead,
  );
  if (zone.bird.grounded && rising && tick >= jumpUntil.tick) {
    jumpUntil.tick = tick + 8;
  }
  return { ...idle, jumpHeld: tick < jumpUntil.tick, move };
}

it("warned vent terrace approach observes from a refuge, crosses an inactive window and exits", () => {
  const f = fixture();
  const leftGoal = (f.refuges.left.min + f.refuges.left.max) / 2;
  const rightGoal = (f.refuges.right.min + f.refuges.right.max) / 2;
  const exitGoal = 60 * TILE;
  const jump = { tick: 0 };
  let zone = startZone(ordinary, f.layout, 1);
  let stage: "approach" | "observe" | "cross" | "exit" = "approach";
  const observed = new Set<string>();
  let lethalWhileSheltered = false;
  let crossedInactive = false;
  for (let tick = 0; tick < TICK_LIMIT; tick++) {
    const phase = phaseOf(f, zone);
    if (stage === "approach" && onDeck(f, zone, f.refuges.left)) {
      stage = "observe";
    }
    if (stage === "observe") {
      observed.add(phase!);
      lethalWhileSheltered ||= effectiveCollision(f.object, zone.behaviours[f.vent]) === "hazard";
      // Commit only at the start of recovery, after the full warning and active phases.
      if (lethalWhileSheltered && zone.behaviours[f.vent]!.stateKey === "recovery") {
        stage = "cross";
      }
    }
    if (stage === "cross" && onDeck(f, zone, f.refuges.right)) {
      stage = "exit";
    }
    const goal =
      stage === "approach" || stage === "observe"
        ? leftGoal
        : stage === "cross"
          ? rightGoal
          : exitGoal;
    zone = stepZone(
      SKILL_PROFILES,
      ordinary,
      f.layout,
      STEP_SECONDS,
      input(f, zone, goal, jump, tick),
      zone,
    );
    expect(zone.death, stage).toBeUndefined();
    if (stage === "cross" && overlapsVent(f, zone)) {
      expect(phaseOf(f, zone)).not.toBe("active");
      crossedInactive = true;
    }
    if (stage === "exit" && zone.cleared) {
      expect([...observed].sort()).toEqual(["active", "inactive", "warning"]);
      expect(lethalWhileSheltered).toBe(true);
      expect(crossedInactive).toBe(true);
      return;
    }
  }
  expect.fail(JSON.stringify({ bird: zone.bird, stage }));
});

it("warned vent kills a crossing that meets its active phase and retries from the start", () => {
  const f = fixture();
  const jump = { tick: 0 };
  let zone = startZone(ordinary, f.layout, 1);
  let sheltered = false;
  for (let tick = 0; tick < TICK_LIMIT && zone.death === undefined; tick++) {
    sheltered ||= onDeck(f, zone, f.refuges.left);
    // Stand inside the vent from the warning onward instead of returning to refuge.
    const goal = sheltered && phaseOf(f, zone) !== "inactive" ? f.rect.x : f.refuges.left.min;
    zone = stepZone(
      SKILL_PROFILES,
      ordinary,
      f.layout,
      STEP_SECONDS,
      input(f, zone, goal, jump, tick),
      zone,
    );
    if (zone.death === undefined) {
      expect(phaseOf(f, zone) === "active" && overlapsVent(f, zone)).toBe(false);
    }
  }
  expect(zone.death).toBeDefined();
  expect(overlapsVent(f, zone)).toBe(true);
  expect(phaseOf(f, zone)).toBe("active");
  const retried = retryZone(ordinary, f.layout, zone);
  expect(retried.death).toBeUndefined();
  expect(retried.attempt).toBe(zone.attempt + 1);
  expect(retried.behaviours[f.vent]!.stateKey).toBe(
    f.layout.areas[f.layout.start.area]!.objects[f.vent]!.behaviour!.initial,
  );
});

it("warned vent warning leaves time to retreat to the near refuge and cross the next window", () => {
  const f = fixture();
  const leftGoal = (f.refuges.left.min + f.refuges.left.max) / 2;
  const rightGoal = (f.refuges.right.min + f.refuges.right.max) / 2;
  const jump = { tick: 0 };
  let zone = startZone(ordinary, f.layout, 1);
  let stage: "approach" | "commit" | "retreat" | "wait" | "cross" = "approach";
  let enteredVent = false;
  for (let tick = 0; tick < TICK_LIMIT; tick++) {
    const state = zone.behaviours[f.vent]!.stateKey;
    if (stage === "approach" && onDeck(f, zone, f.refuges.left) && state === "inactive") {
      stage = "commit";
    }
    if (stage === "commit" && state === "warning") {
      stage = "retreat";
    }
    if (stage === "retreat" && onDeck(f, zone, f.refuges.left) && state === "active") {
      stage = "wait";
    }
    if (stage === "wait" && state === "recovery") {
      stage = "cross";
    }
    const goal =
      stage === "commit" ? f.rect.x + f.rect.width / 2 : stage === "cross" ? rightGoal : leftGoal;
    zone = stepZone(
      SKILL_PROFILES,
      ordinary,
      f.layout,
      STEP_SECONDS,
      input(f, zone, goal, jump, tick),
      zone,
    );
    expect(zone.death, stage).toBeUndefined();
    enteredVent ||= stage === "commit" && overlapsVent(f, zone);
    if (stage === "cross" && onDeck(f, zone, f.refuges.right)) {
      expect(enteredVent).toBe(true);
      return;
    }
  }
  expect.fail(JSON.stringify({ bird: zone.bird, stage }));
});
