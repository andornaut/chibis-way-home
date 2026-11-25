import { expect, it } from "vitest";

import { BIRD_FRAME } from "../../assets/index.ts";
import { STEP_SECONDS } from "../../core/index.ts";
import { BIRD } from "../../data/bird.ts";
import { TILE } from "../../data/screen.ts";
import { SKILL_PROFILES } from "../../progress/index.ts";
import { CATALOGUE, HITBOXES, TILESETS } from "../../testing/walkSuite.ts";
import { startBird } from "../bird/bird.ts";
import { zonePlanOf } from "../stage/assemble.ts";
import { zoneLayout } from "../stage/tiles.ts";
import { CHUNK_LIBRARY } from "../stage/zonePlans.ts";
import { activateBehaviour, startZone, stepZone } from "./zone.ts";

// Chibi stands beside a boss on its own floor, so Bini's growl pushes him and Fert's parcels and
// Pebble's droppings spawn. Trixi rushes a still Chibi beside her before she lays a trap.
const CHUNKS = [
  ["arena-bear-ravine", "ravine"],
  ["arena-ferret-residential-floors", "apartment-residential"],
  ["arena-pigeon-freight-terminal", "freight-terminal"],
] as const;
const STILL = { jumpHeld: false, move: 0, useHeld: false } as const;

// The force pulses and transients the boss's entry effects make while Chibi stands still.
function effects(id: string, theme: string, offset: number): number {
  const plan = zonePlanOf(CHUNK_LIBRARY, () => 0, { door: [], event: [] }, theme, 2, [id]);
  const layout = zoneLayout(TILE, BIRD_FRAME, CATALOGUE, HITBOXES, TILESETS, new Set(), plan);
  const objects = layout.areas[layout.start.area]!.objects;
  const boss = objects.find((object) => object.behaviour?.pursuit)!;
  let zone = startZone(BIRD, layout, 1);
  zone = zone.behaviours.reduce((state, _, index) => activateBehaviour(index, state), zone);
  zone = {
    ...zone,
    bird: startBird(BIRD, {
      x: boss.origin.x + offset * TILE,
      y: boss.origin.y + boss.height - BIRD.height,
    }),
  };
  let count = 0;
  for (let tick = 0; tick < 900 && !zone.death; tick++) {
    zone = stepZone(SKILL_PROFILES, BIRD, layout, STEP_SECONDS, STILL, zone);
    count += zone.pulses.length + zone.transients.length;
  }
  return count;
}

it.each(CHUNKS)("applies %s's entry effects to the zone beside Chibi in %s", (id, theme) => {
  expect([-6, -3, 3, 6].some((offset) => effects(id, theme, offset) > 0)).toBe(true);
}, 600_000);
