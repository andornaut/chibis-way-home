import { describe, expect, it } from "vitest";

import { BIRD } from "../data/bird";
import type { BirdState } from "../rules/bird";
import { STEP_MS } from "../rules/step";
import { birdFrameAt, type BirdPose, stepPose } from "./bird";

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

const pose = (tag: BirdPose["tag"], ms = 0): BirdPose => ({ ms, tag });

describe("stepPose", () => {
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
