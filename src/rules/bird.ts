import type { BirdTuning, Point, Rect, Size } from "../data/types";
import { overlaps } from "./rect";

// Pixels of rounding error allowed when she stands exactly on an edge.
export const EDGE = 1e-6;

// What the player asks of the bird this step. jumpHeld is the button's state; a jump starts on
// the step it goes down.
export interface BirdInput {
  readonly jumpHeld: boolean;
  readonly move: -1 | 0 | 1;
  // External velocity for this step, separate from locomotion and platform momentum.
  readonly push?: Point;
}

export interface BirdState {
  // Seconds a pressed jump still waits to start, should she land or still be in coyote time.
  readonly bufferLeft: number;
  // Speed along x carried from a moving platform she left, kept until she lands or meets a wall.
  readonly carryVx: number;
  // Seconds after leaving the ground in which a jump still starts. 0 once she has jumped.
  readonly coyoteLeft: number;
  readonly facing: -1 | 1;
  readonly grounded: boolean;
  readonly jumpHeld: boolean;
  // Seconds Jump has been held since it started her jump; 0 while it is up.
  readonly jumpHeldFor: number;
  // Position at takeoff, used to preserve the minimum height on release.
  readonly jumpFromY: number;
  // A released ascent cannot regain speed from another press.
  readonly jumpRise: "free" | "held" | "hop";
  readonly vx: number;
  readonly vy: number;
  // Her collision box's top-left corner.
  readonly x: number;
  readonly y: number;
}

export function startBird(tuning: BirdTuning, start: Point): BirdState {
  return {
    bufferLeft: 0,
    carryVx: 0,
    coyoteLeft: 0,
    facing: 1,
    grounded: false,
    jumpFromY: 0,
    jumpHeld: false,
    jumpHeldFor: 0,
    jumpRise: "free",
    vx: 0,
    vy: 0,
    x: start.x - tuning.width / 2,
    y: start.y - tuning.height,
  };
}

export function birdBox(tuning: BirdTuning, bird: BirdState): Rect {
  return { height: tuning.height, width: tuning.width, x: bird.x, y: bird.y };
}

// The whole-pixel rect her drawn frame, frame big, covers: its bottom edge on her collision
// box's bottom edge and its horizontal centre on the box's, where the zone draws her sprite.
export function birdFrameRect(tuning: BirdTuning, frame: Size, bird: BirdState): Rect {
  return {
    height: frame.height,
    width: frame.width,
    x: Math.round(bird.x + tuning.width / 2 - frame.width / 2),
    y: Math.round(bird.y + tuning.height - frame.height),
  };
}

// Moves speed toward target by at most step.
function approach(speed: number, target: number, step: number): number {
  return speed < target ? Math.min(target, speed + step) : Math.max(target, speed - step);
}

// Compensate for applying gravity before movement so the minimum hop reaches its target.
function hopSpeed(gravity: number, seconds: number, remaining: number): number {
  const halfStep = (gravity * seconds) / 2;
  return halfStep + Math.sqrt(2 * gravity * remaining + halfStep ** 2);
}

// A forced move cannot pass through a thin solid between its starting and ending boxes.
function pushedPosition(
  solids: readonly Rect[],
  axis: "x" | "y",
  box: Rect,
  desired: number,
): number {
  const across = axis === "x" ? "y" : "x";
  const length = axis === "x" ? "width" : "height";
  const depth = axis === "x" ? "height" : "width";
  let end = desired;
  for (const solid of solids) {
    if (box[across] >= solid[across] + solid[depth] || solid[across] >= box[across] + box[depth]) {
      continue;
    }
    if (desired > box[axis] && box[axis] + box[length] <= solid[axis] + EDGE) {
      end = Math.min(end, solid[axis] - box[length]);
    } else if (desired < box[axis] && box[axis] >= solid[axis] + solid[length] - EDGE) {
      end = Math.max(end, solid[axis] + solid[length]);
    }
  }
  return end;
}

// One fixed step of seconds: steer, jump, fall, then move along x and along y in turn, each
// stopped at the first solid in the way. Ledges stop her only from above: falling onto one from
// at or above its top, never rising or walking through it. Every fall flutters: it never passes
// the flutter speed.
export function stepBird(
  tuning: BirdTuning,
  solids: readonly Rect[],
  ledges: readonly Rect[],
  seconds: number,
  input: BirdInput,
  bird: BirdState,
): BirdState {
  const accel = bird.grounded ? tuning.groundAccel : tuning.airAccel;
  let vx = approach(bird.vx, input.move * tuning.walkSpeed, accel * seconds);
  let vy = bird.vy;

  const jumpPressed = input.jumpHeld && !bird.jumpHeld;
  let bufferLeft = jumpPressed ? tuning.jumpBuffer : Math.max(0, bird.bufferLeft - seconds);
  let coyoteLeft = Math.max(0, bird.coyoteLeft - seconds);
  let jumpRise = bird.jumpRise;
  let jumpFromY = bird.jumpFromY;
  const fullHeight = tuning.jumpSpeed ** 2 / (2 * tuning.gravity);
  const ascentGravity = (2 * fullHeight) / tuning.jumpRiseTime ** 2;
  // Seconds Jump was held before this step, since it started her jump.
  let heldBefore = bird.jumpHeldFor;
  if ((jumpPressed || bufferLeft > 0) && (bird.grounded || bird.coyoteLeft > 0)) {
    vy = -(2 * fullHeight) / tuning.jumpRiseTime;
    jumpFromY = bird.y;
    bufferLeft = 0;
    coyoteLeft = 0;
    heldBefore = 0;
    // A buffered press already released remains a low hop.
    jumpRise = input.jumpHeld ? "held" : "hop";
    if (!input.jumpHeld) {
      vy = -hopSpeed(ascentGravity, seconds, tuning.jumpHopHeight);
    }
  }
  const jumpHeldFor = input.jumpHeld ? heldBefore + seconds : 0;
  const released = bird.jumpHeld && !input.jumpHeld;
  if (released && vy < 0 && jumpRise === "held") {
    const progress = Math.max(
      0,
      Math.min(1, (heldBefore - tuning.jumpTapWindow) / tuning.jumpReleaseBlendTime),
    );
    const retained = progress * progress * (3 - 2 * progress);
    const remaining = Math.max(0, tuning.jumpHopHeight - (jumpFromY - bird.y));
    // Cut upward speed only on release. Holding never changes the ballistic ascent.
    vy = -Math.min(-vy, Math.max(-vy * retained, hopSpeed(ascentGravity, seconds, remaining)));
    jumpRise = "hop";
  }
  const gravity = vy < 0 && jumpRise !== "free" ? ascentGravity : tuning.gravity;
  vy = Math.min(vy + gravity * seconds, tuning.flutterFallSpeed);
  if (vy >= 0) {
    jumpRise = "free";
  }

  let carryVx = bird.carryVx;
  const moving = vx + carryVx + (input.push?.x ?? 0);
  const intendedX = bird.x + moving * seconds;
  let x = input.push?.x ? pushedPosition(solids, "x", birdBox(tuning, bird), intendedX) : intendedX;
  if (x !== intendedX) {
    vx = 0;
    carryVx = 0;
  }
  for (const solid of solids) {
    const box = { height: tuning.height, width: tuning.width, x, y: bird.y };
    if (overlaps(box, solid)) {
      x = moving > 0 ? solid.x - tuning.width : solid.x + solid.width;
      vx = 0;
      carryVx = 0;
    }
  }

  // grounded is found afresh each step: standing on a solid, gravity carries her a fraction of a
  // pixel into it, and the check below lands her again.
  const verticalPush = input.push?.y ?? 0;
  const falling = vy + verticalPush;
  const intendedY = bird.y + falling * seconds;
  let y = input.push?.y
    ? pushedPosition(solids, "y", { ...birdBox(tuning, bird), x }, intendedY)
    : intendedY;
  if (input.push?.y && falling > 0) {
    y = pushedPosition(ledges, "y", { ...birdBox(tuning, bird), x }, y);
  }
  let grounded = y !== intendedY && falling > 0;
  if (y !== intendedY) {
    vy = 0;
    jumpRise = "free";
  }
  for (const solid of solids) {
    const box = { height: tuning.height, width: tuning.width, x, y };
    if (overlaps(box, solid)) {
      if ((verticalPush === 0 ? vy : falling) > 0) {
        y = solid.y - tuning.height;
        grounded = true;
      } else {
        y = solid.y + solid.height;
      }
      vy = 0;
      jumpRise = "free";
    }
  }
  const bottom = bird.y + tuning.height;
  for (const ledge of ledges) {
    const box = { height: tuning.height, width: tuning.width, x, y };
    if (
      (verticalPush === 0 ? vy : falling) > 0 &&
      bottom <= ledge.y + EDGE &&
      overlaps(box, ledge)
    ) {
      y = ledge.y - tuning.height;
      grounded = true;
      vy = 0;
      jumpRise = "free";
    }
  }
  if (grounded) {
    coyoteLeft = tuning.coyoteTime;
    carryVx = 0;
  }

  return {
    bufferLeft,
    carryVx,
    coyoteLeft,
    facing: input.move === 0 ? bird.facing : input.move,
    grounded,
    jumpFromY,
    jumpHeld: input.jumpHeld,
    jumpHeldFor,
    jumpRise,
    vx,
    vy,
    x,
    y,
  };
}
