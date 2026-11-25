import { expect, it } from "vitest";

import { STEP_SECONDS } from "../core/index.ts";
import { TRAP_SCORE } from "../data/bossScorers.ts";
import { TILE } from "../data/screen.ts";
import type { BossScorerInput } from "../data/types/index.ts";
import { SKILL_PROFILES } from "../progress/index.ts";
import { startBird } from "../rules/bird/index.ts";
import { activateBehaviour, startZone, stepZone, type ZoneState } from "../rules/zone/index.ts";
import { arenaLayout, sampleArenaCase } from "../testing/arenas.ts";
import { ORDINARY } from "../testing/encounterLayouts.ts";

const STILL = { jumpHeld: false, move: 0, useHeld: false } as const;
const found = sampleArenaCase("goose-antagonist");
const layout = arenaLayout(found);
const objects = layout.areas[layout.start.area]!.objects;
const index = objects.findIndex(({ character }) => character === found.arena.boss);
const trixi = objects[index]!;
const plan = trixi.behaviour!;
// Her trap: the character her release state spawns, and the tell that leads to it.
const [release, trap] = Object.entries(plan.states).flatMap(([key, { onEnter = [] }]) =>
  onEnter.flatMap((action) => (action.kind === "spawn" ? [[key, action.character] as const] : [])),
)[0]!;
const tellKey = Object.entries(plan.states).find(([, { transitions }]) =>
  transitions.some(({ to }) => to === release),
)![0];
// Her trap gate, from its considerations: Chibi farther out than the horizontal gap and nearer
// than the height gap at which the trap scores nothing.
const curve = (input: BossScorerInput) =>
  TRAP_SCORE.considerations.find((consideration) => consideration.input === input)!.curve;
const MIN_GAP = curve("horizontalGap").from * TILE;
const MAX_HEIGHT = curve("heightGap").to * TILE;
// Her floor, and the nook's step on it, which she is too tall to enter; Chibi stands at its end
// nearer her.
const FLOOR = found.arena.entry.row * TILE;
const step = found.arena.solids.find(({ row, rows }) => row + rows === found.arena.entry.row)!;
const START = { x: (step.col + step.cols) * TILE - ORDINARY.width, y: step.row * TILE };
// Her opening charge's cooldown runs before any attack, so she lays one within two of them.
const TICKS = Math.ceil((2 * plan.attackCooldownSeconds!) / STEP_SECONDS);

// Chibi's and Trixi's gaps: hers measured from her layout box, never narrower than her body.
function gaps(zone: ZoneState) {
  const at = zone.objects[index]!;
  const { x, y } = zone.bird;
  return {
    height: Math.abs(at.y + trixi.height - (y + ORDINARY.height)),
    horizontal: Math.max(at.x - x - ORDINARY.width, x - at.x - trixi.width),
  };
}

it("lays Trixi's trap on her floor for a still Chibi on the nook's step inside her trap gate", () => {
  let zone = activateBehaviour(index, startZone(ORDINARY, layout, 1));
  zone = { ...zone, bird: startBird(ORDINARY, { x: START.x, y: START.y - ORDINARY.height }) };
  let tell: ReturnType<typeof gaps> | undefined;
  let tick = 0;
  for (; tick < TICKS && !zone.death; tick++) {
    zone = stepZone(SKILL_PROFILES, ORDINARY, layout, STEP_SECONDS, STILL, zone);
    if (tell === undefined && zone.behaviours[index]!.stateKey === tellKey) {
      tell = gaps(zone);
      expect(zone.objects[index]!.y + trixi.height).toBe(FLOOR);
    }
    if (zone.transients.some(({ emitter }) => emitter === index)) {
      break;
    }
  }
  const witness = JSON.stringify({ bird: zone.bird, tell, tick });
  expect(zone.death, witness).toBeUndefined();
  expect(tell, witness).toBeDefined();
  expect(tell!.height, witness).toBeLessThan(MAX_HEIGHT);
  expect(tell!.horizontal, witness).toBeGreaterThan(MIN_GAP);
  expect(zone.bird).toMatchObject({ grounded: true, x: START.x, y: START.y - ORDINARY.height });
  const spawned = zone.transients.find(({ emitter }) => emitter === index);
  expect(spawned?.object.character, witness).toBe(trap);
  expect(spawned!.at.y + spawned!.object.height).toBe(FLOOR);
});
