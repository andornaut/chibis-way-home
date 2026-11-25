import { describe, expect, it } from "vitest";

import { STEP_SECONDS } from "../../core/index.ts";
import { BOSS_CHARACTERS } from "../../data/achievements.ts";
import { ARENAS } from "../../data/arenas/index.ts";
import { BIRD } from "../../data/bird.ts";
import type { ZoneLayout } from "../../data/types/index.ts";
import { SKILL_PROFILES } from "../../progress/index.ts";
import { arenaLayout, gameArenaCase } from "../../testing/arenas.ts";
import { contactBox } from "../boss/behaviourTrack.ts";
import { activateBehaviour, startZone, stepZone, type ZoneInput, type ZoneState } from "./zone.ts";

const STILL: ZoneInput = { jumpHeld: false, move: 0, useHeld: false };
const CHARACTERS = Object.values(BOSS_CHARACTERS).sort();

// Each boss on the first admitted arena that holds it, every behaviour active.
const ENCOUNTERS = new Map<string, { index: number; layout: ZoneLayout; zone: ZoneState }>();
for (const arena of ARENAS) {
  if (ENCOUNTERS.size === CHARACTERS.length) {
    break;
  }
  const layout = arenaLayout(gameArenaCase(arena));
  const { objects } = layout.areas[layout.start.area]!;
  const index = objects.findIndex(({ character }) => CHARACTERS.includes(character));
  const character = objects[index]?.character;
  if (character === undefined || ENCOUNTERS.has(character)) {
    continue;
  }
  const started = startZone(BIRD, layout, 1);
  const zone = started.behaviours.reduce((state, _, at) => activateBehaviour(at, state), started);
  ENCOUNTERS.set(character, { index, layout, zone });
}

function encounter(character: string) {
  const found = ENCOUNTERS.get(character);
  if (!found) {
    throw new Error(`No admitted arena holds ${character}`);
  }
  return found;
}

const step = (layout: ZoneLayout, zone: ZoneState) =>
  stepZone(SKILL_PROFILES, BIRD, layout, STEP_SECONDS, STILL, zone);

describe("death reason", () => {
  it.each(CHARACTERS)("reports %s's body as boss contact", (character) => {
    const { index, layout, zone } = encounter(character);
    const object = layout.areas[zone.area]!.objects[index]!;
    const box = contactBox(object, zone.objects[index]!, zone.behaviours[index]!.facing);
    const dead = step(layout, {
      ...zone,
      bird: {
        ...zone.bird,
        x: box.x + (box.width - BIRD.width) / 2,
        y: box.y + (box.height - BIRD.height) / 2,
      },
    });
    expect(dead.death?.contact).toMatchObject({ index, kind: "object" });
    expect(dead.death?.reason).toBe("boss");
  });

  // Cooldown permits pursuit and leaves the body lethal.
  it.each(CHARACTERS)("reports %s's body as boss contact through its attack cooldown", (character) => {
    const { index, layout, zone } = encounter(character);
    const object = layout.areas[zone.area]!.objects[index]!;
    const behaviour = zone.behaviours[index]!;
    const box = contactBox(object, zone.objects[index]!, behaviour.facing);
    const cooling = zone.behaviours.map((state, at) =>
      at === index
        ? { ...state!, attackCooldownRemainingSeconds: object.behaviour!.attackCooldownSeconds! }
        : state,
    );
    const dead = step(layout, {
      ...zone,
      behaviours: cooling,
      bird: {
        ...zone.bird,
        x: box.x + (box.width - BIRD.width) / 2,
        y: box.y + (box.height - BIRD.height) / 2,
      },
    });
    expect(dead.behaviours[index]!.attackCooldownRemainingSeconds).toBeGreaterThan(0);
    expect(dead.death?.reason).toBe("boss");
  });

  const emitters = CHARACTERS.flatMap((character) => {
    const { index, layout, zone } = encounter(character);
    const templates = layout.areas[zone.area]!.objects[index]!.spawnTemplates ?? {};
    return Object.keys(templates)
      .sort()
      .map((spawned) => ({ character, spawned }));
  });

  it("finds a boss that emits a transient", () => {
    expect(emitters.length).toBeGreaterThan(0);
  });

  it.each(emitters)("reports $character's $spawned as boss contact", ({ character, spawned }) => {
    const { index, layout, zone } = encounter(character);
    const template = layout.areas[zone.area]!.objects[index]!.spawnTemplates![spawned]!;
    const dead = step(layout, {
      ...zone,
      nextTransientId: 1,
      transients: [
        {
          age: 0,
          armSeconds: 0,
          at: { x: zone.bird.x, y: zone.bird.y },
          emitter: index,
          gravity: 0,
          id: 0,
          lifeSeconds: 1,
          object: template,
          velocity: { x: 0, y: 0 },
        },
      ],
    });
    expect(dead.death?.contact).toMatchObject({ emitter: index, id: 0, kind: "transient" });
    expect(dead.death?.reason).toBe("boss");
  });
});
