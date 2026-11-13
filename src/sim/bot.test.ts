import { describe, expect, it } from "vitest";

import { BIRD_FRAME } from "../assets/index.ts";
import { EDGE, STEP_SECONDS } from "../core/index.ts";
import { BIRD } from "../data/bird.ts";
import type { BehaviourMotion, ObjectLayout, Rect, ZoneLayout } from "../data/types/index.ts";
import { ordinaryJumpReleaseTargetHeight, startBird, stepBird } from "../rules/bird.ts";
import { orbitPosition } from "../rules/orbit.ts";
import type { Transient } from "../rules/transients.ts";
import { startZone } from "../rules/zone.ts";
import { emissionBounds } from "./behaviourBounds.ts";
import {
  adaptiveJumpHoldTicks,
  botInput,
  DIAGNOSTIC_SKILL,
  FORWARD_POLICY,
  newBot,
  prepareSensors,
} from "./bot.ts";
import { zoneSurfaces } from "./zoneWalk.ts";

const ground = { height: 20, width: 1100, x: 0, y: 120 };
function fixture(solids: readonly Rect[], objects: readonly ObjectLayout[] = []): ZoneLayout {
  return {
    areas: {
      main: {
        backX: 0,
        chunks: [],
        entries: { start: { x: 60, y: 120 } },
        exitX: 1000,
        height: 200,
        objects,
        solids,
        terrain: [],
        tileset: undefined,
        width: 1100,
      },
    },
    birdFrame: BIRD_FRAME,
    start: { area: "main", entry: "start" },
  };
}
const platform: ObjectLayout = {
  animations: {
    idle: undefined,
    move: undefined,
    open: undefined,
    react: undefined,
    talk: undefined,
  },
  art: "platform",
  character: "platform",
  collision: "ledge",
  height: 12,
  hitbox: undefined,
  interaction: { kind: "none", range: 0 },
  lines: [],
  motion: {
    algorithm: "linear",
    direction: "left",
    distance: 60,
    hopHeight: 0,
    pause: 0,
    speed: 30,
    variance: 0,
  },
  origin: { x: 150, y: 120 },
  phase: 0,
  quips: [],
  quirks: [],
  reaction: { kind: "none", range: 0, speed: 0 },
  room: undefined,
  scene: undefined,
  width: 36,
};

describe("local bot decisions", () => {
  it.each([
    { motion: { kind: "wait" }, moving: false },
    {
      motion: { direction: 1, hopHeight: 20, hopSeconds: 0.4, kind: "hop", speed: 0 },
      moving: true,
    },
  ] satisfies readonly { motion: BehaviourMotion; moving: boolean }[])(
    "classifies a $motion.kind graph for live obstacle sensing",
    ({ motion, moving }) => {
      const object: ObjectLayout = {
        ...platform,
        behaviour: {
          axis: "x",
          distance: 0,
          initial: "active",
          states: { active: { animation: null, motion, transitions: [] } },
        },
        motion: { ...platform.motion, algorithm: "static", distance: 0, speed: 0 },
      };
      expect(prepareSensors(fixture([ground], [object])).movers.main?.has(0)).toBe(moving);
    },
  );
  it("keeps orbiting hazards live without cutting their reference pose from static ground", () => {
    const host = {
      ...platform,
      motion: { ...platform.motion, algorithm: "linear" as const, distance: 24, speed: 24 },
      origin: { x: 600, y: 84 },
    };
    const orbit = {
      angularSpeed: Math.PI,
      host: 0,
      kind: "circle" as const,
      phase: Math.PI / 2,
      radius: 24,
    };
    const child: ObjectLayout = {
      ...platform,
      collision: "hazard",
      height: 4,
      motion: { ...platform.motion, algorithm: "static", distance: 0, speed: 0 },
      orbit,
      origin: orbitPosition(0, { ...host.origin, height: host.height, width: host.width }, orbit, {
        height: 4,
        width: 4,
      }),
      width: 4,
    };
    const layout = fixture([ground], [host, child]);
    expect(prepareSensors(layout).movers.main?.has(1)).toBe(true);
    expect(
      zoneSurfaces(BIRD, layout).some(
        (surface) =>
          surface.mover === undefined &&
          surface.left === ground.x &&
          surface.right === ground.x + ground.width,
      ),
    ).toBe(true);
  });
  it("reads transient arming, movement, removal and attempt resets through the same sensor index", () => {
    const layout = fixture([ground]);
    const sensors = prepareSensors(layout);
    const initial = startZone(BIRD, layout, 1);
    const entity: Transient = {
      age: 0,
      armSeconds: 1,
      at: { x: 100, y: 108 },
      emitter: 0,
      gravity: 0,
      id: 0,
      lifeSeconds: 5,
      object: { ...platform, collision: "hazard", height: 12, width: 12 },
      velocity: { x: 0, y: 0 },
    };
    const armed = { ...entity, age: 1 };
    for (const { attempt, jump, transients } of [
      { attempt: 0, jump: false, transients: [entity] },
      { attempt: 0, jump: true, transients: [armed] },
      { attempt: 0, jump: false, transients: [{ ...armed, at: { x: 1000, y: 108 } }] },
      { attempt: 0, jump: false, transients: [] },
      { attempt: 1, jump: false, transients: [entity] },
    ]) {
      const zone = { ...initial, attempt, bird: { ...initial.bird, grounded: true }, transients };
      expect(
        botInput(BIRD, sensors, layout, DIAGNOSTIC_SKILL, FORWARD_POLICY, zone, newBot(1)).jumpHeld,
      ).toBe(jump);
    }
  });
  it("bounds emitted hazards and gusts beyond the actor track for local phase selection", () => {
    const action = {
      armSeconds: 0,
      character: "falling-block",
      gravity: 10,
      kind: "spawn" as const,
      lifeSeconds: 3,
      maxAlive: 1,
      offset: { x: 20, y: -10 },
      velocity: { x: 10, y: -10 },
    };
    const object: ObjectLayout = {
      ...platform,
      behaviour: {
        axis: "x",
        distance: 0,
        initial: "active",
        states: {
          active: { animation: null, motion: { kind: "wait" }, onEnter: [action], transitions: [] },
        },
      },
      height: 12,
      spawnTemplates: { "falling-block": { ...platform, height: 12, width: 12 } },
      width: 36,
    };
    const track = { height: 12, width: 36, x: 100, y: 100 };
    expect(emissionBounds(object, track)).toEqual({ height: 32, width: 62, x: 100, y: 85 });
    const active = object.behaviour!.states.active!;
    const mirrored: ObjectLayout = {
      ...object,
      behaviour: {
        ...object.behaviour!,
        states: { active: { ...active, onEnter: [{ ...action, mirrorWithFacing: true }] } },
      },
    };
    expect(emissionBounds(mirrored, track)).toEqual({ height: 32, width: 88, x: 74, y: 85 });
    const gust: ObjectLayout = {
      ...object,
      behaviour: {
        ...object.behaviour!,
        states: {
          active: {
            ...active,
            onEnter: [
              {
                height: 20,
                kind: "force-pulse",
                range: 80,
                seconds: 0.4,
                velocity: { x: 40, y: 0 },
              },
            ],
          },
        },
      },
    };
    expect(emissionBounds(gust, track)).toEqual({ height: 32, width: 196, x: 20, y: 80 });
  });
  it("walks through a linked exit instead of treating the next floor as a gap", () => {
    const original = fixture([{ ...ground, width: 200 }]);
    const main = original.areas.main;
    if (!main) {
      throw new Error("Missing fixture area");
    }
    const layout = {
      ...original,
      areaOrder: ["main", "upper"],
      areas: {
        main: { ...main, exitX: 188, walkLinks: { right: { area: "upper", entry: "start" } } },
        upper: { ...main, walkLinks: { left: { area: "main", entry: "start" } } },
      },
    };
    const initial = startZone(BIRD, layout, 1);
    const zone = { ...initial, bird: { ...initial.bird, grounded: true, x: 188 - BIRD.width - 1 } };
    expect(
      botInput(
        BIRD,
        prepareSensors(layout),
        layout,
        DIAGNOSTIC_SKILL,
        FORWARD_POLICY,
        zone,
        newBot(1),
      ),
    ).toEqual({ jumpHeld: false, move: 1, useHeld: false });
  });
  it("uses a shorter hold for a low obstacle than for a tall one", () => {
    const holds = [12, 60].map((height) => {
      const layout = fixture([ground, { height, width: 12, x: 100, y: 120 - height }]);
      const initial = startZone(BIRD, layout, 1);
      const zone = { ...initial, bird: { ...initial.bird, grounded: true } };
      const bot = newBot(1);
      expect(
        botInput(BIRD, prepareSensors(layout), layout, DIAGNOSTIC_SKILL, FORWARD_POLICY, zone, bot)
          .jumpHeld,
      ).toBe(true);
      return bot.holding;
    });
    expect(holds[0]).toBeLessThan(holds[1] ?? 0);
  });
  it("waits for live platform alignment, resumes when it arrives, and bounds waiting", () => {
    const layout = fixture([{ ...ground, width: 96 }], [platform]);
    const sensors = prepareSensors(layout);
    const initial = startZone(BIRD, layout, 1);
    const zone = { ...initial, bird: { ...initial.bird, grounded: true } };
    const bot = newBot(1);
    const skill = { ...DIAGNOSTIC_SKILL, maxWaitTicks: 2 };
    expect(botInput(BIRD, sensors, layout, skill, FORWARD_POLICY, zone, bot).move).toBe(0);
    const aligned = { ...zone, objects: [{ x: 108, y: 120 }] };
    expect(botInput(BIRD, sensors, layout, skill, FORWARD_POLICY, aligned, bot).move).toBe(1);
    const waiting = newBot(1);
    expect(botInput(BIRD, sensors, layout, skill, FORWARD_POLICY, zone, waiting).move).toBe(0);
    expect(botInput(BIRD, sensors, layout, skill, FORWARD_POLICY, zone, waiting).move).toBe(0);
    expect(botInput(BIRD, sensors, layout, skill, FORWARD_POLICY, zone, waiting).move).toBe(1);
  });
});

describe("adaptive ordinary jump holds", () => {
  const bounds = {
    maximum: DIAGNOSTIC_SKILL.jumpHoldTicks,
    minimum: DIAGNOSTIC_SKILL.minJumpHoldTicks!,
  };

  it("keeps low obstacles at the minimum but selects beyond the tap window for a hop-height wall", () => {
    expect(adaptiveJumpHoldTicks(BIRD, bounds, 12)).toBe(bounds.minimum);
    const lastTap = Math.floor(BIRD.jumpTapWindow / STEP_SECONDS);
    expect(ordinaryJumpReleaseTargetHeight(BIRD, lastTap * STEP_SECONDS)).toBe(BIRD.jumpHopHeight);
    expect(adaptiveJumpHoldTicks(BIRD, bounds, BIRD.jumpHopHeight)).toBe(lastTap + 1);
  });

  it.each([48, 60])(
    "chooses the smallest allowed hold and clears a native %ipx wall top",
    (height) => {
      const selected = adaptiveJumpHoldTicks(BIRD, bounds, height);
      expect(selected).toBeDefined();
      const hold = selected!;
      expect(Number.isInteger(hold)).toBe(true);
      expect(hold).toBeGreaterThanOrEqual(bounds.minimum);
      expect(hold).toBeLessThanOrEqual(bounds.maximum);
      expect(hold * STEP_SECONDS).toBeGreaterThan(BIRD.jumpTapWindow);
      expect(ordinaryJumpReleaseTargetHeight(BIRD, hold * STEP_SECONDS)).toBeGreaterThanOrEqual(
        height + EDGE,
      );
      expect(ordinaryJumpReleaseTargetHeight(BIRD, (hold - 1) * STEP_SECONDS)).toBeLessThan(
        height + EDGE,
      );
      const wall = { height, width: 12, x: 100, y: ground.y - height };
      const layout = fixture([ground, wall]);
      const sensors = prepareSensors(layout);
      const initial = startZone(BIRD, layout, 1);
      let bird = stepBird(
        BIRD,
        [ground, wall],
        [],
        STEP_SECONDS,
        { jumpHeld: false, move: 0 },
        startBird(BIRD, { x: 60, y: ground.y }),
      );
      const bot = newBot(1);
      const input = botInput(
        BIRD,
        sensors,
        layout,
        DIAGNOSTIC_SKILL,
        FORWARD_POLICY,
        { ...initial, bird },
        bot,
      );
      expect(input.jumpHeld).toBe(true);
      expect(bot.holding).toBe(hold - 1);
      let aboveWall = false;
      for (let tick = 0; tick < 120 && bird.x < wall.x + wall.width; tick++) {
        bird = stepBird(
          BIRD,
          [ground, wall],
          [],
          STEP_SECONDS,
          { jumpHeld: tick < hold, move: 1 },
          bird,
        );
        aboveWall ||=
          bird.x + BIRD.width > wall.x &&
          bird.x < wall.x + wall.width &&
          bird.y + BIRD.height <= wall.y + EDGE;
      }
      expect(aboveWall).toBe(true);
      expect(bird.x).toBeGreaterThanOrEqual(wall.x + wall.width);
    },
  );

  it("reports unavailable when the cap stays within the tap window and preserves the caller's cap fallback", () => {
    const maximum = Math.floor(BIRD.jumpTapWindow / STEP_SECONDS);
    const height = 48;
    expect(adaptiveJumpHoldTicks(BIRD, { ...bounds, maximum }, height)).toBeUndefined();
    expect(
      adaptiveJumpHoldTicks(BIRD, { maximum: bounds.minimum - 1, minimum: bounds.minimum }, 12),
    ).toBeUndefined();
    const layout = fixture([ground, { height, width: 12, x: 100, y: ground.y - height }]);
    const initial = startZone(BIRD, layout, 1);
    const zone = { ...initial, bird: { ...initial.bird, grounded: true } };
    const bot = newBot(1);
    const input = botInput(
      BIRD,
      prepareSensors(layout),
      layout,
      { ...DIAGNOSTIC_SKILL, jumpHoldTicks: maximum },
      FORWARD_POLICY,
      zone,
      bot,
    );
    expect(input.jumpHeld).toBe(true);
    expect(bot.holding).toBe(maximum - 1);
    expect(ordinaryJumpReleaseTargetHeight(BIRD, maximum * STEP_SECONDS)).toBeLessThan(
      height + EDGE,
    );
  });

  it("does not report an unavailable high wall as clearing at the configured maximum", () => {
    const maximumRise = ordinaryJumpReleaseTargetHeight(BIRD, bounds.maximum * STEP_SECONDS);
    expect(adaptiveJumpHoldTicks(BIRD, bounds, maximumRise)).toBeUndefined();
    expect(adaptiveJumpHoldTicks(BIRD, bounds, maximumRise + 1)).toBeUndefined();
  });
});

it("preserves full-cap holds for a gap or hazard instead of adapting to their observed height", () => {
  for (const layout of [
    fixture([{ ...ground, width: 96 }]),
    fixture([ground], [{ ...platform, collision: "hazard", origin: { x: 100, y: 108 } }]),
  ]) {
    const initial = startZone(BIRD, layout, 1);
    const zone = { ...initial, bird: { ...initial.bird, grounded: true } };
    const bot = newBot(1);
    expect(
      botInput(BIRD, prepareSensors(layout), layout, DIAGNOSTIC_SKILL, FORWARD_POLICY, zone, bot)
        .jumpHeld,
    ).toBe(true);
    expect(bot.holding).toBe(DIAGNOSTIC_SKILL.jumpHoldTicks - 1);
  }
});

it("keeps the observed-height early release and draws randomness only for the initial jump", () => {
  const height = 60;
  const wall = { height, width: 12, x: 100, y: ground.y - height };
  const layout = fixture([ground, wall]);
  const sensors = prepareSensors(layout);
  const initial = startZone(BIRD, layout, 1);
  const zone = { ...initial, bird: { ...initial.bird, grounded: true } };
  let draws = 0;
  const bot = {
    ...newBot(1),
    random: () => {
      draws++;
      return 1;
    },
  };
  expect(
    botInput(BIRD, sensors, layout, DIAGNOSTIC_SKILL, FORWARD_POLICY, zone, bot).jumpHeld,
  ).toBe(true);
  expect(bot.targetY).toBe(wall.y);
  expect(
    botInput(BIRD, sensors, layout, DIAGNOSTIC_SKILL, FORWARD_POLICY, zone, bot).jumpHeld,
  ).toBe(true);
  const cleared = { ...zone, bird: { ...zone.bird, grounded: false, y: wall.y - BIRD.height } };
  expect(
    botInput(BIRD, sensors, layout, DIAGNOSTIC_SKILL, FORWARD_POLICY, cleared, bot).jumpHeld,
  ).toBe(false);
  expect(bot.holding).toBe(0);
  expect(draws).toBe(1);
});
