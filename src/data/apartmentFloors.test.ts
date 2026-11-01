import { describe, expect, it } from "vitest";

import ferretSheet from "../../public/art/sprites/ferret-antagonist.json";
import { assembleZone, zonePlanOf } from "../rules/assemble";
import { chunkProblems, recipeProblems } from "../rules/chunk";
import { STEP_SECONDS } from "../rules/step";
import { zoneLayout } from "../rules/tiles";
import { startZone, stepZone, type ZoneInput, type ZoneState } from "../rules/zone";
import { CHUNK_LIBRARY } from "../rules/zonePlans";
import { CATALOGUE, HITBOXES, TILESETS } from "../testing/walkSuite";
import { BIRD_FRAME } from "../view/bird";
import { BIRD } from "./bird";
import { ZONE_MAP } from "./map";
import { SCREEN, TILE } from "./screen";
import type { TilePoint, ZonePlan } from "./types";
import { APARTMENT_CHUNKS, APARTMENT_SPAWN_ROW } from "./zone6";
import { RECIPES } from "./zones";

const floors = ZONE_MAP.destinations.find(({ id }) => id === "apartment")!.stages;
const layoutOf = (plan: ZonePlan) =>
  zoneLayout(TILE, BIRD_FRAME, CATALOGUE, HITBOXES, TILESETS, new Set(), plan);
const input = (move: -1 | 0 | 1, jumpHeld = false): ZoneInput => ({
  jumpHeld,
  move,
  useHeld: false,
});

function stepUntil(
  plan: ZonePlan,
  start: TilePoint | undefined,
  control: (zone: ZoneState, tick: number) => ZoneInput,
  done: (zone: ZoneState) => boolean,
) {
  const layout = layoutOf(plan);
  let zone = startZone(BIRD, layout, 1);
  if (start) {
    zone = {
      ...zone,
      bird: {
        ...zone.bird,
        grounded: true,
        vx: 0,
        vy: 0,
        x: start.col * TILE,
        y: start.row * TILE - BIRD.height,
      },
    };
  }
  for (let tick = 0; tick < 600 && !zone.death && !zone.turnedBack && !done(zone); tick++) {
    zone = stepZone(BIRD, layout, STEP_SECONDS, control(zone, tick), zone);
  }
  return zone;
}

function cap(id: string): ZonePlan {
  return zonePlanOf(CHUNK_LIBRARY, () => 0, { door: [], event: [] }, "apartment-lobby", 2, [id]);
}

function climb(points: readonly TilePoint[], verticalFirst: boolean) {
  let index = 0;
  let jumpAt: number | undefined;
  let release = false;
  return (zone: ZoneState, tick: number): ZoneInput => {
    const target = points[index];
    if (!target) {
      return input(0);
    }
    const feet = zone.bird.y + BIRD.height;
    if (
      zone.bird.grounded &&
      Math.abs(feet - target.row * TILE) < 0.01 &&
      zone.bird.x >= target.col * TILE - TILE / 2
    ) {
      index++;
      jumpAt = undefined;
      release = true;
      return input(0);
    }
    if (release) {
      release = false;
      return input(0);
    }
    jumpAt ??= tick;
    const moving = !verticalFirst || feet <= target.row * TILE;
    return input(
      moving && zone.bird.x < target.col * TILE ? 1 : 0,
      (tick - jumpAt) * STEP_SECONDS < BIRD.jumpRiseTime,
    );
  };
}

describe("Apartment floor geometry", () => {
  it("keeps taller caps within the same horizontal seam contracts", () => {
    for (const chunk of Object.values(APARTMENT_CHUNKS)) {
      expect(chunkProblems(CHUNK_LIBRARY, CATALOGUE, chunk)).toEqual([]);
    }
  });
  it("leaves the actual cinematic sprite runway clear at the lower spawn height", () => {
    const frame = Object.values(ferretSheet.frames)[0]!.sourceSize;
    const left = SCREEN.width / 2 - frame.w / 2;
    const top = APARTMENT_SPAWN_ROW * TILE - frame.h;
    const blocked = APARTMENT_CHUNKS["apartment-floor-start"]!.solids.filter(
      (solid) =>
        solid.col * TILE < SCREEN.width + frame.w &&
        (solid.col + solid.cols) * TILE > left &&
        solid.row * TILE < APARTMENT_SPAWN_ROW * TILE &&
        (solid.row + solid.rows) * TILE > top,
    );
    expect(blocked).toEqual([]);
  });
  it.each(floors)(
    "assembles %s with its authored lower spawn, upper goal and left map exit",
    (id) => {
      const recipe = RECIPES[id]!;
      expect(recipeProblems(CHUNK_LIBRARY, recipe)).toEqual([]);
      const plan = assembleZone(CHUNK_LIBRARY, 1, id, recipe);
      const area = plan.areas[plan.start.area]!;
      expect(area.entries[plan.start.entry]!.row).toBeGreaterThan(
        plan.stageExit!.rect.row + plan.stageExit!.rect.rows,
      );
      expect(
        area.chunks!.reduce(
          (sum, placed) => sum + CHUNK_LIBRARY.chunks[placed.chunk]!.encounters,
          0,
        ),
      ).toBe(recipe.encounters);
      const zone = stepUntil(
        plan,
        undefined,
        () => input(-1),
        (state) => state.turnedBack,
      );
      expect(zone.death).toBeUndefined();
      expect(zone.turnedBack).toBe(true);
    },
  );
  it("climbs from the protected lower opening to its upper seam", () => {
    const plan = cap("apartment-floor-start");
    const control = climb(
      [75, 70, 65, 60, 55, 50].map((row, index) => ({ col: 12 + index * 5, row })),
      true,
    );
    const zone = stepUntil(
      plan,
      { col: 2, row: APARTMENT_SPAWN_ROW },
      control,
      (state) => state.bird.grounded && state.bird.y + BIRD.height === 50 * TILE,
    );
    expect(zone.death).toBeUndefined();
    expect(zone.bird.grounded).toBe(true);
    expect(zone.bird.y + BIRD.height).toBe(50 * TILE);
  });
  it("boards a retained lift, rides its ascent and transfers to the upper refuge", () => {
    const plan = cap("apartment-tall-compound-double-lift");
    const layout = layoutOf(plan);
    const area = layout.areas[layout.start.area]!;
    const mover = area.objects.findIndex(
      (object) => object.collision === "ledge" && object.behaviour?.axis === "y",
    );
    expect(mover).toBeGreaterThanOrEqual(0);
    let phase: "board" | "ride" | "transfer" = "board";
    let jumpAt = 0;
    const zone = stepUntil(
      plan,
      { col: 5, row: 40 },
      (state, tick) => {
        const feet = state.bird.y + BIRD.height;
        if (
          phase === "board" &&
          state.bird.grounded &&
          state.bird.x + BIRD.width > state.objects[mover]!.x &&
          state.bird.x < state.objects[mover]!.x + area.objects[mover]!.width &&
          Math.abs(feet - state.objects[mover]!.y) < 0.01
        ) {
          phase = "ride";
        }
        if (phase === "ride" && state.objects[mover]!.y <= 32 * TILE) {
          phase = "transfer";
          jumpAt = tick;
        }
        if (phase === "ride") {
          return input(0);
        }
        const target = phase === "board" ? 12 : 24;
        return input(
          state.bird.x < target * TILE ? 1 : 0,
          (tick - jumpAt) * STEP_SECONDS < BIRD.jumpRiseTime,
        );
      },
      (state) =>
        state.bird.grounded &&
        Math.abs(state.bird.y + BIRD.height - 30 * TILE) < 0.01 &&
        state.bird.x >= 22 * TILE,
    );
    expect(zone.death).toBeUndefined();
    expect(phase).toBe("transfer");
    expect(zone.bird.grounded).toBe(true);
    expect(zone.bird.y + BIRD.height).toBe(30 * TILE);
    expect(zone.bird.x).toBeGreaterThanOrEqual(22 * TILE);
  });
  it("climbs the final shelves and activates the upper stairs without Use", () => {
    const plan = cap("apartment-floor-finish");
    const first = climb([{ col: 10, row: 25 }], true);
    const rest = climb(
      [
        { col: 22, row: 20 },
        { col: 34, row: 15 },
        { col: 46, row: 10 },
      ],
      false,
    );
    let reachedFirst = false;
    const finish = CHUNK_LIBRARY.chunks["apartment-floor-finish"]!;
    const withGoal: ZonePlan = {
      ...plan,
      stageExit: { area: plan.start.area, rect: RECIPES.lobby!.stageExit! },
    };
    const zone = stepUntil(
      withGoal,
      { col: 5, row: finish.entry.row },
      (state, tick) => {
        reachedFirst ||= state.bird.grounded && state.bird.y + BIRD.height === 25 * TILE;
        if (!reachedFirst) {
          return first(state, tick);
        }
        if (state.bird.grounded && state.bird.y + BIRD.height === 10 * TILE) {
          return input(1);
        }
        return rest(state, tick);
      },
      (state) => state.cleared,
    );
    expect(zone.death).toBeUndefined();
    expect(zone.cleared).toBe(true);
  });
});
