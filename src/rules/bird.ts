import { clamp } from "@andornaut/game-kit/numbers";
import { rectsOverlap } from "@andornaut/game-kit/rect";

import { EDGE, STEP_SECONDS } from "../core";
import type { BirdTuning, Point, Rect, Size } from "../data/types";

// What the player asks of the bird this step. jumpHeld is the button's state; a jump starts on
// the step it goes down.
export interface BirdInput {
  readonly dashPressed?: boolean;
  readonly jumpHeld: boolean;
  readonly move: -1 | 0 | 1;
  // External velocity for this step, separate from locomotion and platform momentum.
  readonly push?: Point;
}

interface JumpReleaseCurve {
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

function startsAirJump(tuning: BirdTuning, input: BirdInput, bird: BirdState): boolean {
  const jumpPressed = input.jumpHeld && !bird.jumpHeld;
  const groundJump = jumpPressed && (bird.grounded || bird.coyoteLeft > 0);
  return (
    tuning.doubleJump === true && jumpPressed && !groundJump && !bird.grounded && !bird.airJumpUsed
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

export function ordinaryHorizontalVelocity(
  tuning: BirdTuning,
  seconds: number,
  move: BirdInput["move"],
  grounded: boolean,
  velocity: number,
): number {
  const acceleration =
    move === 0 ? tuning.brakeAccel : grounded ? tuning.groundAccel : tuning.airAccel;
  return approach(velocity, move * tuning.walkSpeed, acceleration * seconds);
}

export function ordinaryFallVelocity(
  tuning: BirdTuning,
  seconds: number,
  velocity: number,
): number {
  return Math.min(velocity + tuning.gravity * seconds, tuning.flutterFallSpeed);
}

interface AscentCurve {
  readonly seconds: number;
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
const SAMPLED_ASCENT_PEAKS = new WeakMap<
  BirdTuning,
  { readonly frames: number; readonly rise: number }
>();

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
    seconds: tuning.jumpRiseTime,
    shape,
  };
  ASCENT_CURVES.set(tuning, curve);
  return curve;
}

const AIR_ASCENT_CURVES = new WeakMap<BirdTuning, AscentCurve>();

function airAscentCurve(tuning: BirdTuning): AscentCurve {
  const cached = AIR_ASCENT_CURVES.get(tuning);
  if (cached) {
    return cached;
  }
  const normal = ascentCurve(tuning);
  const scale = Math.sqrt(tuning.doubleJumpHeightRatio);
  const curve = {
    height: normal.height * tuning.doubleJumpHeightRatio,
    initialSpeed: normal.initialSpeed * scale,
    seconds: normal.seconds * scale,
    shape: normal.shape,
  };
  AIR_ASCENT_CURVES.set(tuning, curve);
  return curve;
}

// Integrate a smooth deceleration that is nonnegative throughout the configured ascent and
// joins normal gravity at the apex. The initial speed reserves room for a smooth low-hop stop.
function ascentPoint(tuning: BirdTuning, curve: AscentCurve, elapsed: number): CurvePoint {
  const time = Math.min(elapsed, curve.seconds);
  const s = time / curve.seconds;
  const s2 = s * s;
  const s4 = s2 * s2;
  const s5 = s4 * s;
  const s6 = s5 * s;
  const s7 = s6 * s;
  if (elapsed >= curve.seconds) {
    const fall = elapsed - curve.seconds;
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
      curve.seconds ** 2 * (((tuning.gravity + curve.shape) * s6) / 30 - (curve.shape * s7) / 42),
    velocity:
      -curve.initialSpeed +
      curve.seconds * (((tuning.gravity + curve.shape) * s5) / 5 - (curve.shape * s6) / 6),
  };
}

// Later falling steps use the native velocity recurrence, not this ascent envelope.
export function ordinaryJumpAscent(
  tuning: BirdTuning,
  elapsed: number,
): CurvePoint & { readonly apexRise: number; readonly apexSeconds: number } {
  const curve = ascentCurve(tuning);
  if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed > curve.seconds + STEP_SECONDS) {
    throw new RangeError("Ordinary ascent sample exceeds the first apex-crossing step");
  }
  return {
    ...ascentPoint(tuning, curve, elapsed),
    apexRise: curve.height,
    apexSeconds: curve.seconds,
  };
}

// The highest native fixed-step rise over every ordinary release, from tap to full hold.
function releaseFamilyPeak(tuning: BirdTuning): { readonly frames: number; readonly rise: number } {
  const cached = SAMPLED_ASCENT_PEAKS.get(tuning);
  if (cached) {
    return cached;
  }
  const ground = { height: tuning.height, width: 4 * tuning.width, x: -2 * tuning.width, y: 0 };
  const standing = stepBird(
    tuning,
    [ground],
    [],
    STEP_SECONDS,
    { jumpHeld: false, move: 0 },
    startBird(tuning, { x: 0, y: 0 }),
  );
  let frames = 0;
  let rise = 0;
  const fullHold = Math.ceil(ascentCurve(tuning).seconds / STEP_SECONDS) + 1;
  for (let release = 1; release <= fullHold; release++) {
    let bird = standing;
    for (let tick = 0; tick === 0 || bird.vy < 0; tick++) {
      bird = stepBird(
        tuning,
        [ground],
        [],
        STEP_SECONDS,
        { jumpHeld: tick < release, move: 0 },
        bird,
      );
      if (standing.y - bird.y > rise) {
        rise = standing.y - bird.y;
      }
      frames = Math.max(frames, tick + 1);
    }
  }
  const peak = { frames, rise };
  SAMPLED_ASCENT_PEAKS.set(tuning, peak);
  return peak;
}

// A conservative feet bound for the native ordinary release family, before terrain contact.
export function ordinaryJumpApexFeetY(tuning: BirdTuning, takeoffBodyY: number): number {
  const peak = releaseFamilyPeak(tuning);
  const magnitude = Math.max(1, Math.abs(takeoffBodyY) + tuning.height + peak.rise);
  const roundoff = (4 * peak.frames + 4) * Number.EPSILON * magnitude;
  return takeoffBodyY + tuning.height - peak.rise + roundoff;
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

interface BirdStepResult {
  readonly bird: BirdState;
  readonly support: Rect | undefined;
}

interface LandingSupport {
  support: Rect | undefined;
}

// A forced move cannot pass through a thin solid between its starting and ending boxes.
function pushedPosition(
  landing: LandingSupport | undefined,
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
    const previous = end;
    if (desired > box[axis] && box[axis] + box[length] <= solid[axis] + EDGE) {
      end = Math.min(end, solid[axis] - box[length]);
    } else if (desired < box[axis] && box[axis] >= solid[axis] + solid[length] - EDGE) {
      end = Math.max(end, solid[axis] + solid[length]);
    }
    if (landing && axis === "y" && desired > box.y && end < previous) {
      landing.support = solid;
    }
  }
  return end;
}

function onSupport(tuning: BirdTuning, surfaces: readonly Rect[], bird: BirdState): boolean {
  const feet = bird.y + tuning.height;
  return surfaces.some(
    (surface) =>
      Math.abs(feet - surface.y) <= EDGE &&
      bird.x < surface.x + surface.width &&
      bird.x + tuning.width > surface.x,
  );
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
  return solveBird(tuning, solids, ledges, seconds, input, undefined, bird);
}

export function stepBirdWithSupport(
  tuning: BirdTuning,
  solids: readonly Rect[],
  ledges: readonly Rect[],
  seconds: number,
  input: BirdInput,
  bird: BirdState,
): BirdStepResult {
  const landing: LandingSupport = { support: undefined };
  const next = solveBird(tuning, solids, ledges, seconds, input, landing, bird);
  return { bird: next, support: landing.support };
}

function solveBird(
  tuning: BirdTuning,
  solids: readonly Rect[],
  ledges: readonly Rect[],
  seconds: number,
  input: BirdInput,
  landing: LandingSupport | undefined,
  bird: BirdState,
): BirdState {
  if (landing) {
    landing.support = undefined;
  }
  const burst = tuning.dash;
  let dash =
    bird.dash ??
    (burst
      ? {
          airUsed: false,
          cooldownRemainingSeconds: 0,
          direction: bird.facing,
          ordinaryVx: bird.vx,
          remainingSeconds: 0,
        }
      : undefined);
  const activeBefore = (dash?.remainingSeconds ?? 0) > EDGE;
  if (!burst && dash && activeBefore) {
    dash = { ...dash, remainingSeconds: 0 };
  }
  if (burst && dash && startsDash(tuning, input, bird)) {
    dash = {
      ...dash,
      airUsed: dash.airUsed || !bird.grounded,
      cooldownRemainingSeconds: burst.cooldownSeconds,
      direction: input.move || bird.facing,
      remainingSeconds: burst.durationSeconds,
    };
  }
  const ordinaryVx = ordinaryHorizontalVelocity(
    tuning,
    seconds,
    input.move,
    bird.grounded,
    activeBefore ? dash!.ordinaryVx : bird.vx,
  );
  const dashSeconds = burst && dash ? clamp(0, seconds, dash.remainingSeconds) : 0;
  const horizontalDistance =
    burst && dash && dashSeconds > 0
      ? dash.direction * burst.speed * dashSeconds + ordinaryVx * (seconds - dashSeconds)
      : ordinaryVx * seconds;
  if (dash) {
    const remaining = Math.max(0, dash.remainingSeconds - seconds);
    const roundoff =
      burst && seconds > 0
        ? Number.EPSILON * burst.durationSeconds * Math.ceil(burst.durationSeconds / seconds)
        : 0;
    dash = {
      ...dash,
      cooldownRemainingSeconds: Math.max(0, dash.cooldownRemainingSeconds - seconds),
      ordinaryVx,
      remainingSeconds: remaining > roundoff ? remaining : 0,
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
  let jumpRelease = bird.jumpRelease;
  // Seconds Jump was held before this step, since it started her jump.
  let heldBefore = bird.jumpHeldFor;
  let airJumpUsed = bird.airJumpUsed;
  const supported =
    bird.grounded ||
    ((jumpPressed || bufferLeft > 0) &&
      bird.vy >= 0 &&
      (onSupport(tuning, solids, bird) || onSupport(tuning, ledges, bird)));
  const groundJump = (jumpPressed || bufferLeft > 0) && (supported || bird.coyoteLeft > 0);
  const airJump = !groundJump && startsAirJump(tuning, input, bird);
  const airAscent = airJump || (!groundJump && bird.airJumpUsed);
  const curve = airAscent ? airAscentCurve(tuning) : ascentCurve(tuning);
  const hopHeight = tuning.jumpHopHeight * (airAscent ? tuning.doubleJumpHeightRatio : 1);
  if (groundJump || airJump) {
    if (airJump) {
      airJumpUsed = true;
    } else if (supported) {
      airJumpUsed = false;
    }
    vy = -curve.initialSpeed;
    jumpFromY = bird.y;
    bufferLeft = 0;
    coyoteLeft = 0;
    heldBefore = 0;
    jumpRise = input.jumpHeld ? "held" : "hop";
    jumpRelease = input.jumpHeld ? undefined : releaseCurve(tuning.gravity, -vy, 0, hopHeight);
  }
  const jumpHeldFor = input.jumpHeld ? heldBefore + seconds : 0;
  const released = bird.jumpHeld && !input.jumpHeld;
  if (released && vy < 0 && jumpRise === "held") {
    const progress = Math.max(
      0,
      Math.min(1, (heldBefore - tuning.jumpTapWindow) / tuning.jumpReleaseBlendTime),
    );
    const retained = progress * progress * (3 - 2 * progress);
    const target = hopHeight + retained * (curve.height - hopHeight);
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
    vy = ordinaryFallVelocity(tuning, seconds, vy);
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
      ? pushedPosition(undefined, solids, "x", birdBox(tuning, bird), intendedX)
      : intendedX;
  if (x !== intendedX) {
    vx = 0;
    carryVx = 0;
  }
  for (const solid of solids) {
    const box = { height: tuning.height, width: tuning.width, x, y: bird.y };
    if (rectsOverlap(box, solid)) {
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
    ? pushedPosition(landing, solids, "y", { ...birdBox(tuning, bird), x }, intendedY)
    : intendedY;
  if (input.push?.y && falling > 0) {
    y = pushedPosition(landing, ledges, "y", { ...birdBox(tuning, bird), x }, y);
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
    if (rectsOverlap(box, solid)) {
      if ((verticalPush === 0 && rise === undefined ? vy : falling) > 0) {
        y = solid.y - tuning.height;
        grounded = true;
        if (landing) {
          landing.support = solid;
        }
      } else {
        y = solid.y + solid.height;
        if (landing) {
          landing.support = undefined;
        }
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
      rectsOverlap(box, ledge)
    ) {
      y = ledge.y - tuning.height;
      grounded = true;
      if (landing) {
        landing.support = ledge;
      }
      vy = 0;
      jumpRise = "free";
      jumpRelease = undefined;
      rise = undefined;
    }
  }
  if (landing && !grounded) {
    landing.support = undefined;
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
