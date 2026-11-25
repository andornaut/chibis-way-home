import { BIRD_FRAME } from "../assets/index.ts";
import { STEP_SECONDS } from "../core/index.ts";
import { CHUNKS } from "../data/chunks.ts";
import { TILE } from "../data/screen.ts";
import { SKILL_PROFILES } from "../progress/index.ts";
import { CHUNK_LIBRARY, zoneLayout, zonePlanOf } from "../rules/stage/index.ts";
import { startZone, stepZone, type ZoneState } from "../rules/zone/index.ts";
import { CATALOGUE, HITBOXES, TILESETS } from "./art.ts";
import { ORDINARY } from "./encounterLayouts.ts";

// An authored connector's ordinary route budget, in ticks.
export const CONNECTOR_ROUTE_TICKS = 600;

export interface ConnectorRoute {
  // Whether Chibi ever used an air jump.
  readonly airJumped: boolean;
  readonly cleared: boolean;
  readonly death: ZoneState["death"];
  // Whether the connector has a gate, and whether Chibi passed it.
  readonly gate: boolean;
  readonly passedGate: boolean;
  // The next floor index Chibi was heading for.
  readonly index: number;
  readonly ticks: number;
  readonly x: number;
  readonly y: number;
}

// Crosses connector id alone in theme as Chibi without skills, within CONNECTOR_ROUTE_TICKS. The
// controller decides from observable state: it walks right floor by floor (every full-depth solid
// but a red pit floor), jumps toward a higher floor only once clear of a gate's columns, and holds
// before a gate until it hangs a tile above his head and is not coming down.
export function connectorRoute(theme: string, id: string): ConnectorRoute {
  const chunk = CHUNKS[id]!;
  const plan = zonePlanOf(CHUNK_LIBRARY, () => 0, { door: [], event: [] }, theme, 2, [id]);
  const layout = zoneLayout(TILE, BIRD_FRAME, CATALOGUE, HITBOXES, TILESETS, new Set(), plan);
  const area = layout.areas[plan.start.area]!;
  const floors = chunk.solids.filter(
    (solid) =>
      solid.row + solid.rows === chunk.rows &&
      !chunk.objects.some(
        (object) =>
          object.role === "edge-top" && object.col === solid.col && object.row === solid.row - 1,
      ),
  );
  const guardIndex = area.objects.findIndex(
    ({ behaviour, collision }) => collision === "hazard" && behaviour !== undefined,
  );
  const guard = area.objects[guardIndex];
  // Whether Chibi at x on the gate's floor has yet to leave the gate's columns behind.
  const underGate = (gate: NonNullable<typeof guard>, floor: (typeof floors)[number], x: number) =>
    gate.origin.x >= floor.col * TILE &&
    gate.origin.x < (floor.col + floor.cols) * TILE &&
    x < gate.origin.x + gate.width;
  let zone: ZoneState = startZone(ORDINARY, layout, 1);
  let index = 1;
  let jumpAt: number | undefined;
  let passed = false;
  let airJumped = false;
  // The gate's height on the tick before, to tell a rising gate from a falling one.
  let observed: { readonly step: number; readonly y: number } | undefined;
  let ticks = 0;
  for (; ticks < CONNECTOR_ROUTE_TICKS && !zone.death && !zone.cleared; ticks++) {
    const target = floors[index];
    const feet = zone.bird.y + ORDINARY.height;
    const support = floors.find(
      (solid) =>
        Math.abs(feet - solid.row * TILE) < 0.01 &&
        solid.col * TILE <= zone.bird.x &&
        (solid.col + solid.cols) * TILE > zone.bird.x,
    );
    let move: -1 | 0 | 1 = 1;
    if (
      target &&
      zone.bird.grounded &&
      Math.abs(feet - target.row * TILE) < 0.01 &&
      zone.bird.x >= target.col * TILE
    ) {
      index++;
      jumpAt = undefined;
    } else if (
      target &&
      zone.bird.grounded &&
      feet > target.row * TILE &&
      // Chibi walks under a gate and jumps only once clear of it.
      !(guard && support && underGate(guard, support, zone.bird.x))
    ) {
      // A jump that fell short is released for a tick, then taken again.
      jumpAt =
        jumpAt !== undefined && (ticks - jumpAt) * STEP_SECONDS >= ORDINARY.jumpRiseTime
          ? undefined
          : (jumpAt ?? ticks);
    }
    let held = jumpAt !== undefined && (ticks - jumpAt) * STEP_SECONDS < ORDINARY.jumpRiseTime;
    if (guard && support && !passed && zone.bird.grounded) {
      const supportRight = (support.col + support.cols) * TILE;
      const hold = Math.min(guard.origin.x, supportRight) - ORDINARY.width - TILE;
      const braking = zone.bird.vx ** 2 / (2 * ORDINARY.brakeAccel);
      if (
        guard.origin.x - supportRight <= ORDINARY.width + TILE &&
        guard.origin.x >= support.col * TILE &&
        zone.bird.x + braking >= hold
      ) {
        move = 0;
        held = false;
        jumpAt = undefined;
        // The gate is clear while it hangs a tile above Chibi's head and is not coming down.
        const gateY = zone.objects[guardIndex]!.y;
        if (
          gateY + guard.height <= zone.bird.y - TILE &&
          gateY <= (zone.steps === observed?.step ? observed.y : Infinity)
        ) {
          passed = true;
          move = 1;
        }
      }
    }
    if (guard) {
      observed = { step: zone.steps + 1, y: zone.objects[guardIndex]!.y };
    }
    zone = stepZone(
      SKILL_PROFILES,
      ORDINARY,
      layout,
      STEP_SECONDS,
      { jumpHeld: held, move, useHeld: false },
      zone,
    );
    airJumped ||= zone.bird.airJumpUsed;
  }
  return {
    airJumped,
    cleared: zone.cleared,
    death: zone.death,
    gate: guard !== undefined,
    index,
    passedGate: passed,
    ticks,
    x: zone.bird.x,
    y: zone.bird.y,
  };
}
