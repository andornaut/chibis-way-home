import { describe, expect, it } from "vitest";

import { namedStreams } from "../ai/randomStreams.ts";
import { EDGE, STEP_SECONDS } from "../core/index.ts";
import { GOOSE_BEHAVIOUR } from "../data/behaviours.ts";
import { BIRD } from "../data/bird.ts";
import { TILE } from "../data/screen.ts";
import type { BehaviourMotion, BehaviourPlan, Point, Rect } from "../data/types/index.ts";
import { CATALOGUE, HITBOXES, TILESETS } from "../testing/walkSuite.ts";
import {
  type BehaviourState,
  contactBox,
  layoutBehaviour,
  startBehaviour,
  stepBehaviour,
} from "./behaviour.ts";
import type { BehaviourWorld } from "./behaviourReach.ts";
import { startBird } from "./bird.ts";
import { objectLayout } from "./tiles.ts";

// Trixi's committed charge leftwards along a floor at y 600, with Chibi on the same floor.
const trixi = objectLayout(
  TILE,
  CATALOGUE,
  HITBOXES,
  TILESETS["tiles-street"],
  {},
  { character: "goose-antagonist", col: 40, row: 46 },
);
const floor: Rect = { height: 120, width: 720, x: 0, y: 600 };
const pit: Rect = { height: 24, width: 720, x: 0, y: 696 };
const chibi = { ...startBird(BIRD, { x: 12, y: 600 - BIRD.height }), grounded: true };
const slide = trixi.behaviour!.states.slide!;
const distance = slide.motion.kind === "move" ? slide.motion.distance! : NaN;
const fallback = slide.transitions.flatMap(({ when }) =>
  when.flatMap((condition) => (condition.kind === "elapsed" ? [condition.seconds] : [])),
)[0]!;
// The contact box's left edge relative to the body while facing left.
const contactOffset = contactBox(trixi, trixi.origin, -1).x - trixi.origin.x;

function world(solids: readonly Rect[], tick: number): BehaviourWorld {
  return {
    decisions: namedStreams(1, "boss-slide:main:0"),
    solids,
    targetedAttackWindow: "allowed",
    traversalFrame: {
      bounds: { height: 720, width: 720, x: 0, y: 0 },
      dtSeconds: STEP_SECONDS,
      platforms: [],
      timeSeconds: tick * STEP_SECONDS,
    },
  };
}

interface Sample {
  readonly at: Point;
  readonly state: BehaviourState;
}

function charge(solids: (tick: number, previous: Sample | undefined) => readonly Rect[]) {
  // Starts in the committed rush, so the slide is entered by its transition.
  let state: BehaviourState = {
    ...startBehaviour(BIRD, trixi, chibi),
    active: true,
    activeAttack: { id: "charge", phase: "committed" },
    facing: -1,
    pendingEntry: true,
    pursuit: { phase: "engaged", settled: false, unreachableSeconds: 0 },
    stateKey: "rush",
  };
  let at = trixi.origin;
  const path: Sample[] = [];
  for (let tick = 0; tick < 240; tick++) {
    const step = stepBehaviour(
      BIRD,
      trixi,
      world(solids(tick, path.at(-1)), tick),
      STEP_SECONDS,
      chibi,
      at,
      state,
    );
    at = step.at;
    state = step.state;
    path.push({ at, state });
  }
  return path;
}

const keys = (path: readonly Sample[]) => path.map(({ state }) => state.stateKey);
const sliding = (path: readonly Sample[]) => path.filter(({ state }) => state.stateKey === "slide");

describe("Trixi's slide", () => {
  it("resolves its authored distance in pixels", () => {
    expect(distance).toBe(3 * TILE);
  });

  it.each([0, -1, Number.NaN, Infinity])("rejects a move distance of %s", (bad) => {
    const plan: BehaviourPlan = {
      ...GOOSE_BEHAVIOUR,
      states: {
        ...GOOSE_BEHAVIOUR.states,
        slide: {
          ...GOOSE_BEHAVIOUR.states.slide!,
          motion: {
            ...(slide.motion as Extract<BehaviourMotion, { kind: "move" }>),
            distance: bad,
          },
        },
      },
    };
    expect(() => layoutBehaviour(TILE, plan)).toThrow("Invalid behaviour motion");
  });

  it("follows a committed rush, travels exactly its distance and ends on its boundary", () => {
    const path = charge(() => [floor]);
    const order = keys(path).filter((key, index, all) => key !== all[index - 1]);
    expect(order.slice(0, 3)).toEqual(["rush", "slide", "rest"]);
    const slid = sliding(path);
    const from = slid[0]!.state.travelFrom!;
    expect(slid.every(({ state }) => state.travelFrom === from)).toBe(true);
    expect(slid.every(({ state }) => state.animationTag === "skid")).toBe(true);
    // The boundary ends it exactly at the limit, before the elapsed fallback.
    expect(slid.length * STEP_SECONDS).toBeLessThan(fallback - STEP_SECONDS);
    const rest = path.find(({ state }) => state.stateKey === "rest")!;
    expect(rest.at.x).toBe(from - distance);
    expect(rest.state.travelFrom).toBeUndefined();
    expect(path.every(({ at }) => at.y === trixi.origin.y)).toBe(true);
  });

  it("stops at a ledge it reaches and recovers there at once", () => {
    // The open-floor rush ends at rushEnd; the bank edge lies inside the slide that follows.
    const rushEnd = sliding(charge(() => [floor]))[0]!.state.travelFrom!;
    const edgeAt = rushEnd - distance / 2;
    const x = edgeAt + contactOffset;
    const bank: Rect = { height: floor.height, width: floor.width - x, x, y: floor.y };
    const path = charge(() => [bank, pit]);
    const slid = sliding(path);
    expect(slid[0]!.state.travelFrom).toBe(rushEnd);
    for (const { at, state } of path) {
      expect(at.y).toBe(trixi.origin.y);
      expect(contactBox(trixi, at, state.facing).x).toBeGreaterThanOrEqual(bank.x - EDGE);
    }
    // Blocked short of its limit, it ends there without waiting for the elapsed fallback.
    expect(slid.length * STEP_SECONDS).toBeLessThan(fallback - STEP_SECONDS);
    expect(path.find(({ state }) => state.stateKey === "rest")!.at.x).toBeCloseTo(edgeAt);
  });

  it("falls when its support vanishes mid-slide", () => {
    let gone = false;
    const path = charge((_, previous) => {
      gone ||= previous?.state.stateKey === "slide";
      return gone ? [pit] : [floor];
    });
    const fell = path.findIndex(({ at }) => at.y > trixi.origin.y);
    expect(path[fell - 1]!.state.stateKey).toBe("slide");
    expect(path.at(-1)!.at.y + trixi.height).toBeCloseTo(pit.y);
  });
});
