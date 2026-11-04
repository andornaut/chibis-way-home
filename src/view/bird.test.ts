import { describe, expect, it } from "vitest";

import { EDGE, STEP_MS, STEP_SECONDS } from "../core";
import { BIRD } from "../data/bird";
import { type BirdState, startBird, stepBird } from "../rules/bird";
import { birdFrameAt, type BirdPose, clearAirJumpPose, stepPose } from "./bird";

const LAND_MS = 180;

const STILL: BirdState = {
  airJumpUsed: false,
  bufferLeft: 0,
  carryVx: 0,
  coyoteLeft: 0,
  facing: 1,
  grounded: true,
  jumpFromY: 0,
  jumpHeld: false,
  jumpHeldFor: 0,
  jumpRise: "free",
  vx: 0,
  vy: 0,
  x: 0,
  y: 0,
};
const WALKING: BirdState = { ...STILL, vx: 60 };
const RISING: BirdState = { ...STILL, grounded: false, vy: -100 };
const FALLING: BirdState = { ...STILL, grounded: false, vy: 50 };
const AT_APEX: BirdState = { ...STILL, grounded: false };
const DASHING: BirdState = {
  ...WALKING,
  dash: {
    airUsed: false,
    cooldownRemainingSeconds: 1,
    direction: 1,
    ordinaryVx: WALKING.vx,
    remainingSeconds: 0.25,
  },
};

const pose = (tag: BirdPose["tag"], ms = 0): BirdPose => ({ ms, tag });

describe("stepPose", () => {
  it.each([
    ["ground movement", DASHING, pose("walk")],
    ["rising", { ...DASHING, grounded: false, vy: -100 }, pose("jump")],
    ["falling", { ...DASHING, grounded: false, vy: 50 }, pose("flutter")],
    ["landing hold", DASHING, pose("land")],
  ])("shows the active dash over %s", (_, after, from) => {
    expect(stepPose(LAND_MS, STEP_MS, STILL, after, from)).toEqual(pose("dash"));
  });

  it("keeps the same dash pose clock while the burst remains active", () => {
    expect(stepPose(LAND_MS, STEP_MS, DASHING, DASHING, pose("dash", 60))).toEqual(
      pose("dash", 60 + STEP_MS),
    );
  });

  it.each([
    [
      "expired on the ground",
      { ...DASHING, dash: { ...DASHING.dash!, remainingSeconds: 0 } },
      "walk",
    ],
    ["blocked to a stop", { ...STILL, dash: { ...DASHING.dash!, remainingSeconds: 0 } }, "idle"],
    [
      "at the activity boundary",
      { ...DASHING, dash: { ...DASHING.dash!, remainingSeconds: EDGE } },
      "walk",
    ],
    [
      "expired while rising",
      { ...RISING, dash: { ...DASHING.dash!, airUsed: true, remainingSeconds: 0 } },
      "jump",
    ],
    [
      "expired while falling",
      { ...FALLING, dash: { ...DASHING.dash!, airUsed: true, remainingSeconds: 0 } },
      "flutter",
    ],
    ["dash absent", WALKING, "walk"],
  ] as const)("returns to locomotion with dash %s", (_, after, tag) => {
    expect(stepPose(LAND_MS, STEP_MS, DASHING, after, pose("dash", 130))).toEqual(pose(tag));
  });

  it.each([
    ["idles grounded and still", STILL, STILL, pose("idle", 100), pose("idle", 100 + STEP_MS)],
    ["walks grounded and moving", STILL, WALKING, pose("idle", 100), pose("walk")],
    ["jumps on takeoff", STILL, RISING, pose("walk", 50), pose("jump")],
    ["keeps jumping while rising", RISING, RISING, pose("jump"), pose("jump", STEP_MS)],
    ["flutters once she falls", RISING, FALLING, pose("jump", 300), pose("flutter")],
    ["flutters at the apex", RISING, AT_APEX, pose("jump", 300), pose("flutter")],
    ["flutters walking off a ledge", WALKING, FALLING, pose("walk", 30), pose("flutter")],
    ["lands on the step she lands", FALLING, STILL, pose("flutter", 500), pose("land")],
    ["lands moving", FALLING, WALKING, pose("flutter", 500), pose("land")],
    ["keeps landing while land plays", STILL, WALKING, pose("land"), pose("land", STEP_MS)],
    ["idles once land has played", STILL, STILL, pose("land", LAND_MS - STEP_MS), pose("idle")],
    ["walks once land has played", STILL, WALKING, pose("land", LAND_MS - STEP_MS), pose("walk")],
    ["jumps out of a landing", STILL, RISING, pose("land"), pose("jump")],
  ])("%s", (_, before, after, from, to) => {
    expect(stepPose(LAND_MS, STEP_MS, before, after, from)).toEqual(to);
  });
});

describe("birdFrameAt", () => {
  const frame = { height: 48, width: 64 };
  it.each([
    [0, 0],
    [10.4, 20.4],
    [10.6, 20.6],
    [-3.5, 7.25],
  ])("anchors the frame to the box at %d,%d", (x, y) => {
    const at = birdFrameAt(BIRD, frame, { ...STILL, x, y });
    expect([at.x, at.y].every(Number.isInteger)).toBe(true);
    expect(at.x + frame.width / 2).toBe(Math.round(x + BIRD.width / 2));
    expect(at.y + frame.height).toBe(Math.round(y + BIRD.height));
  });
});

it("plays the accepted second jump once beneath dash priority and clears on landing or cover", () => {
  const before = startBird(BIRD, { x: 100, y: 100 });
  const after = stepBird(BIRD, [], [], STEP_SECONDS, { jumpHeld: true, move: 0 }, before);
  const second = stepPose(LAND_MS, STEP_MS, before, after, pose("jump"));
  expect(second.tag).toBe("double-jump");
  expect(second.airJumpRemainingMs).toBeGreaterThan(0);
  const dash = { ...after, dash: DASHING.dash };
  const overridden = stepPose(LAND_MS, STEP_MS, after, dash, second);
  expect(overridden.tag).toBe("dash");
  expect(overridden.airJumpRemainingMs).toBeLessThan(second.airJumpRemainingMs!);
  const expired = stepPose(LAND_MS, second.airJumpRemainingMs!, after, after, second);
  expect(expired.tag).toBe("jump");
  expect(expired.airJumpRemainingMs).toBeUndefined();
  const landed = stepPose(LAND_MS, STEP_MS, after, STILL, second);
  expect(landed.tag).toBe("land");
  expect(landed.airJumpRemainingMs).toBeUndefined();
  expect(clearAirJumpPose(after, second)).toEqual(pose("jump"));
});
