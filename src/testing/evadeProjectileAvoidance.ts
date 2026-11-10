import { EDGE, sweptContact } from "../core";
import type { BirdTuning, Rect } from "../data/types";
import { birdBox, type BirdState, stepBird } from "../rules/bird";
import type { ZoneInput } from "../rules/zone";
import type { ObservedProjectile, ProjectileObservation } from "./evadeProjectiles";

export interface ProjectileFrame {
  readonly observation: ProjectileObservation;
  readonly tick: number;
}
export interface ProjectileSupport {
  readonly id: number;
  readonly left: number;
  readonly right: number;
  readonly y: number;
}
export interface ProjectileAvoidanceContext {
  readonly bird: BirdState;
  readonly frame?: ProjectileFrame | undefined;
  readonly guard: (body: Rect, input: ZoneInput) => ZoneInput;
  readonly support: () => ProjectileSupport | undefined;
  readonly tick: number;
}
export interface ProjectileAvoidanceResult {
  readonly input: ZoneInput;
  readonly override: boolean;
  readonly problem?: string;
}
type SafeStep = (from: number, to: number, move: -1 | 0 | 1) => boolean;

function advance(seconds: number, projectile: ObservedProjectile): ObservedProjectile {
  return {
    ...projectile,
    rect: {
      ...projectile.rect,
      x: projectile.rect.x + projectile.velocity.x * seconds,
      y:
        projectile.rect.y +
        projectile.velocity.y * seconds +
        (projectile.gravity * seconds * seconds) / 2,
    },
    velocity: { x: projectile.velocity.x, y: projectile.velocity.y + projectile.gravity * seconds },
  };
}

function contact(
  seconds: number,
  before: Rect,
  after: Rect,
  projectile: ObservedProjectile,
  next: ObservedProjectile,
) {
  // A parabola differs from its per-step chord by at most |g|dt²/8, including an internal apex.
  const bend = (Math.abs(projectile.gravity) * seconds * seconds) / 8;
  const expanded = {
    ...projectile.rect,
    height: projectile.rect.height + 2 * bend,
    y: projectile.rect.y - bend,
  };
  return sweptContact(before, after, expanded, { x: next.rect.x, y: next.rect.y - bend });
}

function sameMotion(a: BirdState, b: BirdState) {
  return (
    a.x === b.x &&
    a.y === b.y &&
    a.vx === b.vx &&
    a.vy === b.vy &&
    a.grounded === b.grounded &&
    a.jumpHeld === b.jumpHeld &&
    a.jumpHeldFor === b.jumpHeldFor &&
    a.bufferLeft === b.bufferLeft &&
    a.carryVx === b.carryVx
  );
}

export function createProjectileAvoidance(
  tuning: BirdTuning,
  seconds: number,
  decisionTicks: number,
  delayTicks: number,
  geometry: { readonly ledges: readonly Rect[]; readonly solids: readonly Rect[] },
) {
  let cached:
    | { move: -1 | 0 | 1; states: readonly BirdState[]; support: ProjectileSupport; tick: number }
    | undefined;
  let observedAt = -1;
  let observedFrame: ProjectileFrame | undefined;
  const observe = (tick: number, frame: ProjectileFrame | undefined) => {
    if (tick % decisionTicks === 0 && tick !== observedAt) {
      observedAt = tick;
      observedFrame =
        frame &&
        Number.isSafeInteger(frame.tick) &&
        frame.tick >= 0 &&
        frame.tick + delayTicks <= tick
          ? frame
          : undefined;
    }
    return observedFrame;
  };
  const step = (
    safeStep: SafeStep,
    context: ProjectileAvoidanceContext,
    nominal: ZoneInput,
  ): ProjectileAvoidanceResult => {
    const { bird, frame, guard, support, tick } = context;
    const unchanged = (): ProjectileAvoidanceResult => ({ input: nominal, override: false });
    const unknown = (problem: string): ProjectileAvoidanceResult => {
      cached = undefined;
      return { input: nominal, override: false, problem };
    };
    if (
      !Number.isSafeInteger(tick) ||
      tick < 0 ||
      !Number.isSafeInteger(decisionTicks) ||
      decisionTicks <= 0 ||
      !Number.isSafeInteger(delayTicks) ||
      delayTicks < 0 ||
      !Number.isFinite(seconds) ||
      seconds <= 0 ||
      !Number.isFinite(tuning.brakeAccel) ||
      tuning.brakeAccel <= 0
    ) {
      return unknown("invalid projectile-avoidance time or braking context");
    }
    const selected = observe(tick, frame);
    if (!bird.grounded || bird.jumpHeld || nominal.jumpHeld) {
      cached = undefined;
      return unchanged();
    }
    if (tick % decisionTicks === 0) {
      cached = undefined;
      if (!selected) {
        return unchanged();
      }
      if (selected.observation.kind === "unknown") {
        return unknown(selected.observation.problem);
      }
      if (selected.observation.projectiles.length === 0) {
        return unchanged();
      }
      if (
        selected.observation.projectiles.some(
          ({ gravity, rect, velocity }) =>
            ![gravity, rect.x, rect.y, rect.width, rect.height, velocity.x, velocity.y].every(
              Number.isFinite,
            ) ||
            rect.width <= 0 ||
            rect.height <= 0,
        )
      ) {
        return unknown("invalid observed projectile motion");
      }
      let observed = selected.observation.projectiles;
      for (let elapsed = selected.tick; elapsed < tick; elapsed++) {
        observed = observed.map((projectile) => advance(seconds, projectile));
      }
      const stopTicks = Math.ceil(
        Math.max(tuning.walkSpeed, Math.abs(bird.vx)) / (tuning.brakeAccel * seconds),
      );
      const horizon = decisionTicks + stopTicks;
      if (!Number.isSafeInteger(horizon) || horizon <= 0) {
        return unknown("invalid projectile prediction horizon");
      }
      const forecast = (move: -1 | 0 | 1, constrained?: ProjectileSupport) => {
        let state = bird;
        let projectiles = observed;
        const states = [bird];
        for (let step = 0; step < horizon; step++) {
          const input = { ...nominal, jumpHeld: false, move: step < decisionTicks ? move : 0 };
          const body = birdBox(tuning, state);
          const actual = guard(body, input);
          const next = stepBird(tuning, geometry.solids, geometry.ledges, seconds, actual, state);
          const after = birdBox(tuning, next);
          const nextProjectiles = projectiles.map((projectile) => advance(seconds, projectile));
          const threat = projectiles.find((projectile, index) =>
            contact(seconds, body, after, projectile, nextProjectiles[index]!),
          );
          if (threat) {
            return { states, threat };
          }
          if (
            constrained &&
            (actual.move !== input.move ||
              !next.grounded ||
              after.x < constrained.left - EDGE ||
              after.x > constrained.right + EDGE ||
              Math.abs(after.y + after.height - constrained.y) > EDGE ||
              !safeStep(body.x, after.x, input.move))
          ) {
            return { states, unsafe: true };
          }
          state = next;
          projectiles = nextProjectiles;
          states.push(next);
        }
        return { states };
      };
      const ordinary = forecast(nominal.move);
      if (!ordinary.threat) {
        return unchanged();
      }
      const standing = support();
      if (!standing) {
        return unknown("projectile threat has no known full-foot support");
      }
      const away =
        bird.x + tuning.width / 2 < ordinary.threat.rect.x + ordinary.threat.rect.width / 2
          ? -1
          : 1;
      const moves = [...new Set([nominal.move, 0, away, -away])] as (-1 | 0 | 1)[];
      for (const move of moves) {
        if (move === nominal.move) {
          continue;
        }
        const predicted = forecast(move, standing);
        if (!predicted.threat && !predicted.unsafe) {
          cached = {
            move,
            states: predicted.states.slice(0, decisionTicks + 1),
            support: { ...standing },
            tick,
          };
          break;
        }
      }
      if (!cached) {
        return unknown("no safe ordinary input avoids the observed projectile threat");
      }
    }
    if (!cached) {
      return unchanged();
    }
    const index = tick - cached.tick;
    if (index < 0 || index >= decisionTicks) {
      cached = undefined;
      return unchanged();
    }
    const expected = cached.states[index];
    const next = cached.states[index + 1];
    const standing = support();
    if (
      !expected ||
      !next ||
      !sameMotion(bird, expected) ||
      !standing ||
      standing.id !== cached.support.id ||
      standing.left !== cached.support.left ||
      standing.right !== cached.support.right ||
      standing.y !== cached.support.y
    ) {
      return unknown("projectile-avoidance input no longer matches actual support or motion");
    }
    const input = { ...nominal, move: cached.move };
    if (
      guard(birdBox(tuning, bird), input).move !== input.move ||
      !safeStep(bird.x, next.x, input.move)
    ) {
      return unknown("projectile-avoidance input is no longer admissible");
    }
    return { input, override: true };
  };
  return Object.assign(step, { observe });
}
