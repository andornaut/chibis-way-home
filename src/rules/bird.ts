import type { BirdTuning, Point, Rect, Size } from "../data/types";
import { overlaps } from "./rect";
import { STEP_SECONDS } from "./step";

// Pixels of rounding error allowed when she stands exactly on an edge.
export const EDGE = 1e-6;

// What the player asks of the bird this step. jumpHeld is the button's state; a jump starts on
// the step it goes down.
export interface BirdInput {
  readonly dashPressed?: boolean;
  readonly jumpHeld: boolean;
  readonly move: -1 | 0 | 1;
  // External velocity for this step, separate from locomotion and platform momentum.
  readonly push?: Point;
}

export interface JumpReleaseCurve {
  readonly coefficients: readonly [number, number, number, number, number];
  readonly elapsed: number;
  readonly height: number;
  readonly seconds: number;
}

export interface BirdDashState {
  readonly airUsed: boolean;
  readonly cooldownRemainingSeconds: number;
  readonly direction: -1 | 1;
  readonly ordinaryVx: number;
  readonly remainingSeconds: number;
}

export interface BirdState {
  readonly airJumpUsed: boolean;
  readonly dash?: BirdDashState | undefined;
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
  readonly jumpRelease?: JumpReleaseCurve | undefined;
  readonly vx: number;
  readonly vy: number;
  // Her collision box's top-left corner.
  readonly x: number;
  readonly y: number;
}

export function startsDash(tuning: BirdTuning, input: BirdInput, bird: BirdState): boolean {
  const dash = bird.dash;
  return (
    tuning.dash !== undefined &&
    input.dashPressed === true &&
    (dash?.remainingSeconds ?? 0) <= EDGE &&
    (dash?.cooldownRemainingSeconds ?? 0) <= EDGE &&
    (bird.grounded || !dash?.airUsed)
  );
}

export function startBird(tuning: BirdTuning, start: Point): BirdState {
  return {
    airJumpUsed: false,
    bufferLeft: 0,
    carryVx: 0,
    coyoteLeft: 0,
    ...(tuning.dash && {
      dash: {
        airUsed: false,
        cooldownRemainingSeconds: 0,
        direction: 1 as const,
        ordinaryVx: 0,
        remainingSeconds: 0,
      },
    }),
    facing: 1,
    grounded: false,
    jumpFromY: 0,
    jumpHeld: false,
    jumpHeldFor: 0,
    jumpRelease: undefined,
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

interface AscentCurve {
  readonly height: number;
  readonly initialSpeed: number;
  readonly shape: number;
}
interface CurvePoint {
  readonly acceleration: number;
  readonly rise: number;
  readonly velocity: number;
}
const ASCENT_CURVES = new WeakMap<BirdTuning, AscentCurve>();

function ascentCurve(tuning: BirdTuning): AscentCurve {
  const cached = ASCENT_CURVES.get(tuning);
  if (cached) {
    return cached;
  }
  const full = tuning.jumpSpeed ** 2 / (2 * tuning.gravity);
  const gravity = (2 * full) / tuning.jumpRiseTime ** 2;
  const frames = Math.max(0, Math.ceil(tuning.jumpRiseTime / STEP_SECONDS) - 1);
  // Retain the existing fixed-step full-height target while integrating the new curve exactly.
  const height =
    ((frames * 2 * full) / tuning.jumpRiseTime) * STEP_SECONDS -
    (gravity * STEP_SECONDS ** 2 * frames * (frames + 1)) / 2;
  const shape = 7 * ((6 * height) / tuning.jumpRiseTime ** 2 - tuning.gravity);
  const curve = {
    height,
    initialSpeed: tuning.jumpRiseTime * (tuning.gravity / 5 + shape / 30),
    shape,
  };
  ASCENT_CURVES.set(tuning, curve);
  return curve;
}

// Integrate a smooth deceleration that is nonnegative throughout the configured ascent and
// joins normal gravity at the apex. The initial speed reserves room for a smooth low-hop stop.
function ascentPoint(tuning: BirdTuning, curve: AscentCurve, elapsed: number): CurvePoint {
  const time = Math.min(elapsed, tuning.jumpRiseTime);
  const s = time / tuning.jumpRiseTime;
  const s2 = s * s;
  const s4 = s2 * s2;
  const s5 = s4 * s;
  const s6 = s5 * s;
  const s7 = s6 * s;
  if (elapsed >= tuning.jumpRiseTime) {
    const fall = elapsed - tuning.jumpRiseTime;
    return {
      acceleration: tuning.gravity,
      rise: curve.height - (tuning.gravity * fall * fall) / 2,
      velocity: tuning.gravity * fall,
    };
  }
  return {
    acceleration: s4 * (tuning.gravity + curve.shape * (1 - s)),
    rise:
      curve.initialSpeed * time -
      tuning.jumpRiseTime ** 2 *
        (((tuning.gravity + curve.shape) * s6) / 30 - (curve.shape * s7) / 42),
    velocity:
      -curve.initialSpeed +
      tuning.jumpRiseTime * (((tuning.gravity + curve.shape) * s5) / 5 - (curve.shape * s6) / 6),
  };
}

function releaseCurve(
  gravity: number,
  speed: number,
  acceleration: number,
  height: number,
): JumpReleaseCurve | undefined {
  if (!(height > 0) || !(speed > 0)) {
    return undefined;
  }
  const seconds = (2 * height) / speed;
  const squared = seconds * seconds;
  return {
    coefficients: [
      speed * seconds,
      (-acceleration * squared) / 2,
      10 * height - 6 * speed * seconds + ((3 * acceleration - gravity) * squared) / 2,
      -15 * height + 8 * speed * seconds + (gravity - (3 * acceleration) / 2) * squared,
      6 * height - 3 * speed * seconds + ((acceleration - gravity) * squared) / 2,
    ],
    elapsed: 0,
    height,
    seconds,
  };
}

// A quintic stop matches the incoming position, velocity and acceleration, then meets the
// authored apex with zero velocity and normal gravity. No release velocity is discarded.
function releasePoint(gravity: number, curve: JumpReleaseCurve, elapsed: number): CurvePoint {
  if (elapsed >= curve.seconds) {
    const fall = elapsed - curve.seconds;
    return {
      acceleration: gravity,
      rise: curve.height - (gravity * fall * fall) / 2,
      velocity: gravity * fall,
    };
  }
  const s = elapsed / curve.seconds;
  const [a, b, c, d, e] = curve.coefficients;
  return {
    acceleration: -(2 * b + s * (6 * c + s * (12 * d + s * 20 * e))) / curve.seconds ** 2,
    rise: s * (a + s * (b + s * (c + s * (d + s * e)))),
    velocity: -(a + s * (2 * b + s * (3 * c + s * (4 * d + s * 5 * e)))) / curve.seconds,
  };
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
  const burst = tuning.dash;
  let dash = burst
    ? (bird.dash ?? {
        airUsed: false,
        cooldownRemainingSeconds: 0,
        direction: bird.facing,
        ordinaryVx: bird.vx,
        remainingSeconds: 0,
      })
    : undefined;
  const activeBefore = (dash?.remainingSeconds ?? 0) > EDGE;
  if (burst && dash && startsDash(tuning, input, bird)) {
    dash = {
      ...dash,
      airUsed: dash.airUsed || !bird.grounded,
      cooldownRemainingSeconds: burst.cooldownSeconds,
      direction: input.move || bird.facing,
      remainingSeconds: burst.durationSeconds,
    };
  }
  const accel =
    input.move === 0 ? tuning.brakeAccel : bird.grounded ? tuning.groundAccel : tuning.airAccel;
  const ordinaryVx = approach(
    activeBefore ? dash!.ordinaryVx : bird.vx,
    input.move * tuning.walkSpeed,
    accel * seconds,
  );
  const dashSeconds = burst && dash ? Math.min(seconds, Math.max(0, dash.remainingSeconds)) : 0;
  const horizontalDistance =
    burst && dash && dashSeconds > 0
      ? dash.direction * burst.speed * dashSeconds + ordinaryVx * (seconds - dashSeconds)
      : ordinaryVx * seconds;
  if (dash) {
    dash = {
      ...dash,
      cooldownRemainingSeconds: Math.max(0, dash.cooldownRemainingSeconds - seconds),
      ordinaryVx,
      remainingSeconds: Math.max(0, dash.remainingSeconds - seconds),
    };
  }
  let vx =
    burst && dash && dash.remainingSeconds > EDGE ? dash.direction * burst.speed : ordinaryVx;
  let vy = bird.vy;

  const jumpPressed = input.jumpHeld && !bird.jumpHeld;
  let bufferLeft = jumpPressed ? tuning.jumpBuffer : Math.max(0, bird.bufferLeft - seconds);
  let coyoteLeft = Math.max(0, bird.coyoteLeft - seconds);
  let jumpRise = bird.jumpRise;
  let jumpFromY = bird.jumpFromY;
  const curve = ascentCurve(tuning);
  let jumpRelease = bird.jumpRelease;
  // Seconds Jump was held before this step, since it started her jump.
  let heldBefore = bird.jumpHeldFor;
  let airJumpUsed = bird.airJumpUsed;
  const groundJump = (jumpPressed || bufferLeft > 0) && (bird.grounded || bird.coyoteLeft > 0);
  const airJump =
    tuning.doubleJump === true && jumpPressed && !groundJump && !bird.grounded && !airJumpUsed;
  if (groundJump || airJump) {
    if (airJump) {
      airJumpUsed = true;
    }
    vy = -curve.initialSpeed;
    jumpFromY = bird.y;
    bufferLeft = 0;
    coyoteLeft = 0;
    heldBefore = 0;
    jumpRise = input.jumpHeld ? "held" : "hop";
    jumpRelease = input.jumpHeld
      ? undefined
      : releaseCurve(tuning.gravity, -vy, 0, tuning.jumpHopHeight);
  }
  const jumpHeldFor = input.jumpHeld ? heldBefore + seconds : 0;
  const released = bird.jumpHeld && !input.jumpHeld;
  if (released && vy < 0 && jumpRise === "held") {
    const progress = Math.max(
      0,
      Math.min(1, (heldBefore - tuning.jumpTapWindow) / tuning.jumpReleaseBlendTime),
    );
    const retained = progress * progress * (3 - 2 * progress);
    const target = tuning.jumpHopHeight + retained * (curve.height - tuning.jumpHopHeight);
    const remaining = Math.max(0, target - (jumpFromY - bird.y));
    jumpRelease = releaseCurve(
      tuning.gravity,
      -vy,
      ascentPoint(tuning, curve, heldBefore).acceleration,
      remaining,
    );
    jumpRise = "hop";
  }
  let rise: number | undefined;
  if (jumpRelease) {
    const before = releasePoint(tuning.gravity, jumpRelease, jumpRelease.elapsed);
    const elapsed = jumpRelease.elapsed + seconds;
    const after = releasePoint(tuning.gravity, jumpRelease, elapsed);
    rise = after.rise - before.rise;
    vy = after.velocity;
    jumpRelease = elapsed >= jumpRelease.seconds ? undefined : { ...jumpRelease, elapsed };
  } else if (vy < 0 && jumpRise === "held") {
    const before = ascentPoint(tuning, curve, heldBefore);
    const after = ascentPoint(tuning, curve, heldBefore + seconds);
    rise = after.rise - before.rise;
    vy = after.velocity;
  } else {
    vy += tuning.gravity * seconds;
  }
  vy = Math.min(vy, tuning.flutterFallSpeed);
  if (vy >= 0) {
    jumpRise = "free";
  }

  let carryVx = bird.carryVx;
  const moving =
    (dashSeconds > 0 && seconds > 0 ? horizontalDistance / seconds : vx) +
    carryVx +
    (input.push?.x ?? 0);
  const intendedX = bird.x + moving * seconds;
  let x =
    input.push?.x || dashSeconds > 0
      ? pushedPosition(solids, "x", birdBox(tuning, bird), intendedX)
      : intendedX;
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

  if (dash && x !== intendedX) {
    dash = { ...dash, ordinaryVx: 0, remainingSeconds: 0 };
  }

  // grounded is found afresh each step: standing on a solid, gravity carries her a fraction of a
  // pixel into it, and the check below lands her again.
  const verticalPush = input.push?.y ?? 0;
  const falling = (rise === undefined ? vy : -rise / seconds) + verticalPush;
  const intendedY = bird.y + (rise === undefined ? vy * seconds : -rise) + verticalPush * seconds;
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
    jumpRelease = undefined;
    rise = undefined;
  }
  for (const solid of solids) {
    const box = { height: tuning.height, width: tuning.width, x, y };
    if (overlaps(box, solid)) {
      if ((verticalPush === 0 && rise === undefined ? vy : falling) > 0) {
        y = solid.y - tuning.height;
        grounded = true;
      } else {
        y = solid.y + solid.height;
      }
      vy = 0;
      jumpRise = "free";
      jumpRelease = undefined;
      rise = undefined;
    }
  }
  const bottom = bird.y + tuning.height;
  for (const ledge of ledges) {
    const box = { height: tuning.height, width: tuning.width, x, y };
    if (
      (verticalPush === 0 && rise === undefined ? vy : falling) > 0 &&
      bottom <= ledge.y + EDGE &&
      overlaps(box, ledge)
    ) {
      y = ledge.y - tuning.height;
      grounded = true;
      vy = 0;
      jumpRise = "free";
      jumpRelease = undefined;
      rise = undefined;
    }
  }
  if (grounded) {
    airJumpUsed = false;
    if (dash) {
      dash = { ...dash, airUsed: false };
    }
    coyoteLeft = tuning.coyoteTime;
    carryVx = 0;
  }

  return {
    airJumpUsed,
    bufferLeft,
    carryVx,
    coyoteLeft,
    ...(dash && { dash }),
    facing:
      dash && dash.remainingSeconds > EDGE
        ? dash.direction
        : input.move === 0
          ? bird.facing
          : input.move,
    grounded,
    jumpFromY,
    jumpHeld: input.jumpHeld,
    jumpHeldFor,
    jumpRelease,
    jumpRise,
    vx,
    vy,
    x,
    y,
  };
}
