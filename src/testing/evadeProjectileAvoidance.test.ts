import { expect, it } from "vitest";

import { STEP_SECONDS, sweptContact } from "../core/index.ts";
import { birdBox, type BirdState, startBird, stepBird } from "../rules/bird.ts";
import { startZone, type ZoneInput } from "../rules/zone.ts";
import { bossSample } from "../sim/bossSimulator.ts";
import { arenaLayout, gameArenaCase } from "./arenas.ts";
import { ARENA_SAMPLES } from "./arenaSamples.ts";
import { ORDINARY } from "./encounterLayouts.ts";
import { boundaryInput, launchStepSafe, observeProjectileFrame } from "./evade.ts";
import { createProjectileAvoidance, type ProjectileFrame } from "./evadeProjectileAvoidance.ts";
import { type ObservedProjectile, projectileGravityModels } from "./evadeProjectiles.ts";

const floor = { height: 480, width: 720, x: 0, y: 960 };
const geometry = { ledges: [], solids: [floor] };
const bounds = { backX: 12, canExit: false, exitX: 708 };
const nominal: ZoneInput = { jumpHeld: false, move: 1, useHeld: false };
const guard = (body: ReturnType<typeof birdBox>, input: ZoneInput) =>
  boundaryInput(bounds, body, input);
const standing = () => ({ id: 8, left: 0, right: 696, y: 960 });
const initial = (): BirdState => ({
  ...startBird(ORDINARY, { x: 200.6, y: 960 }),
  grounded: true,
  vx: 240,
});
const falling: ObservedProjectile = {
  emitter: 3,
  gravity: 720,
  id: 1,
  rect: { height: 12, width: 12, x: 220.6, y: 801.0097656249995 },
  velocity: { x: 0, y: 188.25 },
};
const frame: ProjectileFrame = {
  observation: { kind: "known", projectiles: [falling] },
  tick: 294,
};

function advance(projectile: ObservedProjectile): ObservedProjectile {
  return {
    ...projectile,
    rect: {
      ...projectile.rect,
      x: projectile.rect.x + projectile.velocity.x * STEP_SECONDS,
      y:
        projectile.rect.y +
        projectile.velocity.y * STEP_SECONDS +
        (projectile.gravity * STEP_SECONDS ** 2) / 2,
    },
    velocity: {
      x: projectile.velocity.x,
      y: projectile.velocity.y + projectile.gravity * STEP_SECONDS,
    },
  };
}

it("brakes before an observed falling projectile that the unchanged walk would hit", () => {
  let projectile = falling;
  for (let tick = 294; tick < 324; tick++) {
    projectile = advance(projectile);
  }
  let oldBird = initial();
  let bird = initial();
  let oldHit = false;
  let avoidedHit = false;
  let overrides = 0;
  const policy = createProjectileAvoidance(ORDINARY, STEP_SECONDS, 12, 30, geometry);
  for (let tick = 324; tick < 360; tick++) {
    const safe = (from: number, to: number) =>
      launchStepSafe([floor], [], 0, undefined, birdBox(ORDINARY, bird), from, to);
    const result = policy(safe, { bird, frame, guard, support: standing, tick }, nominal);
    expect(result.problem).toBeUndefined();
    if (tick === 324) {
      expect(result.override).toBe(true);
      expect(result.input.move).toBe(0);
    }
    if (result.override) {
      overrides++;
    }
    const nextProjectile = advance(projectile);
    const oldNext = stepBird(
      ORDINARY,
      [floor],
      [],
      STEP_SECONDS,
      guard(birdBox(ORDINARY, oldBird), nominal),
      oldBird,
    );
    const next = stepBird(
      ORDINARY,
      [floor],
      [],
      STEP_SECONDS,
      guard(birdBox(ORDINARY, bird), result.input),
      bird,
    );
    oldHit ||= sweptContact(
      birdBox(ORDINARY, oldBird),
      birdBox(ORDINARY, oldNext),
      projectile.rect,
      nextProjectile.rect,
    );
    avoidedHit ||= sweptContact(
      birdBox(ORDINARY, bird),
      birdBox(ORDINARY, next),
      projectile.rect,
      nextProjectile.rect,
    );
    oldBird = oldNext;
    bird = next;
    projectile = nextProjectile;
  }
  expect(oldHit).toBe(true);
  expect(avoidedHit).toBe(false);
  expect(overrides).toBeGreaterThan(0);
  expect(overrides).toBeLessThan(36);
  expect(bird.grounded).toBe(true);
});

it("does not react to a visible but too-new paired sample before the reaction delay", () => {
  const visible: ProjectileFrame = {
    observation: {
      kind: "known",
      projectiles: [
        {
          ...falling,
          gravity: 0,
          rect: { height: 12, width: 12, x: 300, y: 924 },
          velocity: { x: -240, y: 0 },
        },
      ],
    },
    tick: 324,
  };
  const policy = createProjectileAvoidance(ORDINARY, STEP_SECONDS, 12, 30, geometry);
  const bird = initial();
  const safe = (from: number, to: number) =>
    launchStepSafe([floor], [], 0, undefined, birdBox(ORDINARY, bird), from, to);
  for (const tick of [324, 336, 348, 353]) {
    const result = policy(safe, { bird, frame: visible, guard, support: standing, tick }, nominal);
    expect(result.input).toBe(nominal);
    expect(result.override).toBe(false);
    expect(result.problem).toBeUndefined();
  }
});

it("uses completed-step production observations without leaking the legacy sample index", () => {
  const sample = ARENA_SAMPLES.find(({ boss }) => boss === "pigeon-antagonist")!;
  const found = gameArenaCase(sample);
  const layout = arenaLayout(found);
  const area = layout.areas[layout.start.area]!;
  const emitter = area.objects.findIndex(({ character }) => character === sample.boss);
  const object = area.objects[emitter]!;
  const template = Object.values(object.spawnTemplates!)[0]!;
  // `rise` moves this file's floor-level points onto the sample's entry row.
  const rise = floor.y - area.entries[layout.start.entry]!.y;
  const action = Object.values(object.behaviour!.states)
    .flatMap(({ onEnter }) => onEnter ?? [])
    .find((entry) => entry.kind === "spawn" && entry.character === template.character)!;
  if (action.kind !== "spawn") {
    throw new Error("expected a public projectile spawn model");
  }
  const zone = {
    ...startZone(ORDINARY, layout, 0),
    bird: { ...initial(), y: initial().y - rise },
    seconds: 331 * STEP_SECONDS,
    steps: 331,
    transients: [
      {
        age: action.armSeconds + STEP_SECONDS,
        armSeconds: action.armSeconds,
        at: { x: 300, y: 924 - rise },
        emitter,
        gravity: action.gravity,
        id: 1,
        lifeSeconds: action.lifeSeconds,
        object: template,
        velocity: { x: -ORDINARY.walkSpeed, y: 0 },
      },
    ],
  };
  const visible = observeProjectileFrame(
    ORDINARY,
    layout,
    projectileGravityModels(area.objects),
    zone,
  );
  expect(visible.tick).toBe(bossSample(ORDINARY, layout, 330, zone).tick + 1);
  expect(visible.observation.kind).toBe("known");
  if (visible.observation.kind === "known") {
    expect(visible.observation.projectiles).toHaveLength(1);
  }
  const policy = createProjectileAvoidance(ORDINARY, STEP_SECONDS, 12, 30, geometry);
  const bird = initial();
  const safe = (from: number, to: number) =>
    launchStepSafe([floor], [], 0, undefined, birdBox(ORDINARY, bird), from, to);
  const result = policy(
    safe,
    { bird, frame: visible, guard, support: standing, tick: 360 },
    nominal,
  );
  expect(result.input).toBe(nominal);
  expect(result.override).toBe(false);
  expect(result.problem).toBeUndefined();
});

it("waits for a decision boundary even when the delayed projectile frame is already eligible", () => {
  const policy = createProjectileAvoidance(ORDINARY, STEP_SECONDS, 12, 30, geometry);
  const bird = initial();
  const safe = (from: number, to: number) =>
    launchStepSafe([floor], [], 0, undefined, birdBox(ORDINARY, bird), from, to);
  expect(policy(safe, { bird, frame, guard, support: standing, tick: 325 }, nominal).input).toBe(
    nominal,
  );
  const result = policy(safe, { bird, frame, guard, support: standing, tick: 336 }, nominal);
  expect(result.override).toBe(true);
  expect(result.input.move).toBe(0);
});

it("rejects a cached override after actual motion differs from its ordinary prediction", () => {
  const policy = createProjectileAvoidance(ORDINARY, STEP_SECONDS, 12, 30, geometry);
  const before = initial();
  const safe = (from: number, to: number) =>
    launchStepSafe([floor], [], 0, undefined, birdBox(ORDINARY, before), from, to);
  const first = policy(safe, { bird: before, frame, guard, support: standing, tick: 324 }, nominal);
  expect(first.override).toBe(true);
  expect(first.input.move).toBe(0);
  const bird = stepBird(ORDINARY, [floor], [], STEP_SECONDS, nominal, before);
  const result = policy(safe, { bird, frame, guard, support: standing, tick: 325 }, nominal);
  expect(result.problem).toBeDefined();
  expect(result.override).toBe(false);
  expect(result.input).toBe(nominal);
});

it("leaves far projectiles and airborne or jump controls unchanged", () => {
  const policy = createProjectileAvoidance(ORDINARY, STEP_SECONDS, 12, 30, geometry);
  const forbidden = () => {
    throw new Error("unthreatened input inspected avoidance constraints");
  };
  const distant: ProjectileFrame = {
    ...frame,
    observation: {
      kind: "known",
      projectiles: [{ ...falling, rect: { ...falling.rect, x: 600 } }],
    },
  };
  expect(
    policy(
      forbidden,
      { bird: initial(), frame: distant, guard, support: forbidden, tick: 324 },
      nominal,
    ).input,
  ).toBe(nominal);
  const jump = { ...nominal, jumpHeld: true };
  expect(
    policy(forbidden, { bird: initial(), frame, guard, support: forbidden, tick: 324 }, jump).input,
  ).toBe(jump);
  expect(
    policy(
      forbidden,
      { bird: { ...initial(), grounded: false }, frame, guard, support: forbidden, tick: 324 },
      nominal,
    ).input,
  ).toBe(nominal);
});

it("reports unknown motion and unsupported threats instead of silently omitting them", () => {
  const policy = createProjectileAvoidance(ORDINARY, STEP_SECONDS, 12, 30, geometry);
  const bird = initial();
  const safe = (from: number, to: number) =>
    launchStepSafe([floor], [], 0, undefined, birdBox(ORDINARY, bird), from, to);
  const unknown: ProjectileFrame = {
    observation: { kind: "unknown", problem: "ambiguous public projectile motion" },
    tick: 294,
  };
  const result = policy(
    safe,
    { bird, frame: unknown, guard, support: standing, tick: 324 },
    nominal,
  );
  expect(result.problem).toBe("ambiguous public projectile motion");
  expect(result.controllerFailure).toEqual({ kind: "unknown", problem: result.problem });
  expect(
    policy(safe, { bird, frame, guard, support: () => undefined, tick: 324 }, nominal).problem,
  ).toBeDefined();
});

it("includes an intra-step projectile apex in its conservative relative sweep", () => {
  const policy = createProjectileAvoidance(ORDINARY, STEP_SECONDS, 1, 0, geometry);
  const bird = initial();
  const apex: ProjectileFrame = {
    observation: {
      kind: "known",
      projectiles: [
        {
          emitter: 4,
          gravity: -1152000,
          id: 2,
          rect: { height: 1, width: 12, x: 200, y: 915 },
          velocity: { x: 0, y: 4800 },
        },
      ],
    },
    tick: 0,
  };
  const safe = (from: number, to: number) =>
    launchStepSafe([floor], [], 0, undefined, birdBox(ORDINARY, bird), from, to);
  expect(
    policy(safe, { bird, frame: apex, guard, support: standing, tick: 0 }, nominal).problem,
  ).toBeDefined();
});
