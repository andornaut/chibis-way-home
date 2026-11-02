import { expect, it } from "vitest";

import { assembleZone, zonePlanOf } from "../rules/assemble";
import { chunkProblems } from "../rules/chunk";
import { STEP_SECONDS } from "../rules/step";
import { zoneLayout } from "../rules/tiles";
import { standsOn, startZone, stepZone, type ZoneInput, type ZoneState } from "../rules/zone";
import { CHUNK_LIBRARY } from "../rules/zonePlans";
import { CATALOGUE, HITBOXES, TILESETS } from "../testing/walkSuite";
import { BIRD_FRAME } from "../view/bird";
import { BIRD } from "./bird";
import {
  BLUE_CONNECTORS,
  blueVerticalId,
  CHUNKS,
  COUNTRYSIDE_CONNECTORS,
  countrysideVerticalId,
  FOUR_SCREEN_ROWS,
  HOME_CONNECTORS,
  homeVerticalId,
  INDUSTRIAL_CONNECTORS,
  INDUSTRIAL_ROWS,
  industrialCapId,
  WOODLAND_DEPTH_ALIASES,
  WOODLAND_VERTICAL_ALIASES,
  woodlandVerticalId,
} from "./chunks";
import { REACH } from "./reach";
import { TILE } from "./screen";
import { APARTMENT_LOWER_SHELVES, APARTMENT_SPAWN_ROW } from "./zone6";
import { RECIPES } from "./zones";

it("validates lower seams only inside the taller authored industrial chunks", () => {
  for (const [id, chunk] of Object.entries(CHUNKS)) {
    if (id.startsWith("industrial-")) {
      expect(chunkProblems(CHUNK_LIBRARY, CATALOGUE, chunk), id).toEqual([]);
    }
  }
  const descent = CHUNKS["industrial-descent"]!;
  expect(chunkProblems(CHUNK_LIBRARY, CATALOGUE, { ...descent, rows: 60 })).toContain(
    "exit row 80 is not a seam row",
  );
});

it("preserves opening objects, room slots and spawn routes while extending the industrial floor", () => {
  for (const stage of ["warehouse-district", "loading-yards", "freight-terminal"]) {
    for (const side of ["start", "finish"]) {
      const original = CHUNKS[`${stage}-${side}`]!;
      const tall = CHUNKS[industrialCapId(`${stage}-${side}`)]!;
      expect(tall.rows).toBe(INDUSTRIAL_ROWS);
      expect(tall.objects).toEqual(original.objects);
      expect(tall.slots).toEqual(original.slots);
      expect(tall.entry).toEqual(original.entry);
      expect(tall.exit).toEqual(original.exit);
      expect(tall.solids.map(({ col, cols, row }) => ({ col, cols, row }))).toEqual(
        original.solids.map(({ col, cols, row }) => ({ col, cols, row })),
      );
    }
  }
});

it("keeps every eligible underground seam connected to the surface finish", () => {
  const recipe = RECIPES["freight-terminal"]!;
  if ("sections" in recipe) {
    throw Error("Expected continuous Industrial stage");
  }
  const chunks = recipe.chunks!.map((id) => CHUNKS[id]!);
  const reachable = new Set<number>([CHUNKS[recipe.finish]!.entry.row]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const chunk of chunks) {
      if (reachable.has(chunk.exit.row) && !reachable.has(chunk.entry.row)) {
        reachable.add(chunk.entry.row);
        changed = true;
      }
    }
  }
  expect(chunks.every((chunk) => reachable.has(chunk.entry.row))).toBe(true);
  expect(chunks.filter(({ entry }) => entry.row === 50).map(({ exit }) => exit.row)).toEqual([80]);
  const plan = assembleZone(CHUNK_LIBRARY, 1, "freight-terminal", recipe);
  const selected = plan.areas.main!.chunks!;
  expect(selected[1]!.chunk).toBe("industrial-descent");
  expect(selected.at(-2)!.chunk).toBe("industrial-ascent");
  expect(selected.reduce((sum, { cols }) => sum + cols, 0)).toBeGreaterThanOrEqual(
    recipe.length.min,
  );
  expect(selected.reduce((sum, { cols }) => sum + cols, 0)).toBeLessThanOrEqual(recipe.length.max);
});

it.each([...INDUSTRIAL_CONNECTORS, "outdoor-terrace-ascent"] as const)(
  "crosses %s with ordinary jumps and no movement abilities",
  (id) => {
    const chunk = CHUNKS[id]!;
    const plan = zonePlanOf(
      CHUNK_LIBRARY,
      () => 0,
      { door: [], event: [] },
      id === "outdoor-terrace-ascent" ? "farmland" : "warehouse-district",
      2,
      [id],
    );
    const layout = zoneLayout(TILE, BIRD_FRAME, CATALOGUE, HITBOXES, TILESETS, new Set(), plan);
    const targets = chunk.solids.slice(1);
    let index = 0;
    let jumpAt: number | undefined;
    let release = false;
    let zone: ZoneState = startZone(BIRD, layout, 1);
    let highest = zone.bird.y;
    for (let tick = 0; tick < 600 && !zone.death && !zone.cleared; tick++) {
      const target = targets[index];
      let control: ZoneInput = { jumpHeld: false, move: 1, useHeld: false };
      if (release) {
        release = false;
        control = { ...control, move: 0 };
      } else if (target) {
        const feet = zone.bird.y + BIRD.height;
        if (
          zone.bird.grounded &&
          Math.abs(feet - target.row * TILE) < 0.01 &&
          zone.bird.x >= target.col * TILE
        ) {
          index++;
          jumpAt = undefined;
          release = true;
          control = { ...control, move: 0 };
        } else if (feet > target.row * TILE) {
          if (zone.bird.grounded) {
            jumpAt ??= tick;
          }
          control = {
            ...control,
            jumpHeld: jumpAt !== undefined && (tick - jumpAt) * STEP_SECONDS < BIRD.jumpRiseTime,
          };
        }
      }
      zone = stepZone(BIRD, layout, STEP_SECONDS, control, zone);
      highest = Math.min(highest, zone.bird.y);
    }
    expect(zone.death).toBeUndefined();
    expect(zone.cleared).toBe(true);
    if (chunk.exit.row < chunk.entry.row) {
      expect(highest + BIRD.height).toBeLessThanOrEqual(chunk.exit.row * TILE);
    }
  },
);

it("keeps Blue vertical pools connected through lower space and the upper route", () => {
  for (const stage of ["street", "city-streets", "city-boundary"]) {
    const recipe = RECIPES[stage]!;
    if ("sections" in recipe) {
      throw Error("Expected continuous Blue stage");
    }
    for (const id of [...recipe.chunks!, recipe.start, recipe.finish]) {
      expect(chunkProblems(CHUNK_LIBRARY, CATALOGUE, CHUNKS[id]!), id).toEqual([]);
      expect(CHUNKS[id]!.rows).toBe(FOUR_SCREEN_ROWS);
    }
    const original = CHUNKS[`${stage}-start`]!;
    const start = CHUNKS[blueVerticalId(`${stage}-start`)]!;
    expect(start.objects).toEqual(original.objects);
    expect(start.slots).toEqual(original.slots);
    expect(start.entry).toEqual(original.entry);
  }
  const recipe = RECIPES["city-boundary"]!;
  if ("sections" in recipe) {
    throw Error("Expected continuous Blue stage");
  }
  const plan = assembleZone(CHUNK_LIBRARY, 1, "city-boundary", recipe);
  const ids = plan.areas.main!.chunks!.map(({ chunk }) => chunk);
  expect(ids[1]).toBe("outdoor-descent");
  expect(ids.at(-2)).toBe("outdoor-surface-return");
  for (const id of ["outdoor-lift-ascent", "outdoor-upper-ascent"]) {
    expect(ids).toContain(id);
  }
  expect(
    ids.filter((id) => BLUE_CONNECTORS.includes(id as (typeof BLUE_CONNECTORS)[number])),
  ).not.toEqual([]);
});

it.each(["outdoor-lift-ascent", "outdoor-upper-ascent", "outdoor-surface-return"])(
  "crosses %s with an ordinary no-ability route",
  (id) => {
    const chunk = CHUNKS[id]!;
    const plan = zonePlanOf(CHUNK_LIBRARY, () => 0, { door: [], event: [] }, "street", 2, [id]);
    const layout = zoneLayout(TILE, BIRD_FRAME, CATALOGUE, HITBOXES, TILESETS, new Set(), plan);
    const area = layout.areas.main!;
    const targets = chunk.solids.slice(1);
    const fixtureIndex = area.objects.findIndex((object) =>
      id === "outdoor-lift-ascent" ? object.collision === "ledge" : object.collision === "hazard",
    );
    const fixture = area.objects[fixtureIndex];
    let index = 0;
    let jumpAt: number | undefined;
    let crossing = false;
    let boardedAt: number | undefined;
    let carried = 0;
    let zone = startZone(BIRD, layout, 1);
    let ticks = 0;
    let phase = id === "outdoor-lift-ascent" ? 0 : 1;
    let phaseTicks = 0;
    let approachTicks: number | undefined;
    let approachEnd: ZoneState | undefined;
    for (; phaseTicks < 600 && !zone.death && !zone.cleared; ticks++, phaseTicks++) {
      const target = targets[index];
      const feet = zone.bird.y + BIRD.height;
      let move: -1 | 0 | 1 = 1;
      let held = false;
      if (
        target &&
        zone.bird.grounded &&
        Math.abs(feet - target.row * TILE) < 0.01 &&
        zone.bird.x >= target.col * TILE
      ) {
        index++;
        jumpAt = undefined;
      } else if (target) {
        const at = zone.objects[fixtureIndex];
        if (
          id === "outdoor-lift-ascent" &&
          fixture &&
          at &&
          target.col * TILE > fixture.origin.x &&
          target.col === targets[3]!.col
        ) {
          const deck = { ...at, height: fixture.height, width: fixture.width };
          if (zone.bird.grounded && standsOn(BIRD, zone.bird, deck)) {
            boardedAt ??= at.y;
            carried = Math.max(carried, boardedAt - at.y);
            move = 0;
            jumpAt = undefined;
            if (at.y - target.row * TILE <= 5 * TILE) {
              crossing = true;
              jumpAt = ticks;
              move = 1;
            }
          } else if (!crossing && jumpAt === undefined) {
            const bank = chunk.solids[3]!;
            const hold = (bank.col + bank.cols) * TILE - BIRD.width - TILE;
            if (zone.bird.x >= hold) {
              move = 0;
              if (phase === 1 && feet - at.y >= 0 && feet - at.y <= 5 * TILE) {
                jumpAt = ticks;
                move = 1;
              }
            }
          }
        } else if (
          id === "outdoor-upper-ascent" &&
          fixture &&
          at &&
          target.row === 25 &&
          !crossing
        ) {
          const hold = fixture.origin.x - BIRD.width - TILE;
          if (zone.bird.x >= hold && zone.bird.grounded) {
            move = 0;
            if (
              at.y + fixture.height <=
              fixture.origin.y + fixture.behaviour!.distance + fixture.height + 0.01
            ) {
              crossing = true;
              jumpAt = ticks;
              move = 1;
            }
          }
        } else if (zone.bird.grounded && feet > target.row * TILE) {
          jumpAt ??= ticks;
        }
        held = jumpAt !== undefined && (ticks - jumpAt) * STEP_SECONDS < BIRD.jumpRiseTime;
      }
      zone = stepZone(BIRD, layout, STEP_SECONDS, { jumpHeld: held, move, useHeld: false }, zone);
      if (phase === 0 && index === 3 && zone.bird.grounded && zone.bird.vx === 0) {
        const bank = chunk.solids[3]!;
        const hold = (bank.col + bank.cols) * TILE - BIRD.width - TILE;
        if (zone.bird.x >= hold && Math.abs(zone.bird.y + BIRD.height - bank.row * TILE) < 0.01) {
          expect(
            standsOn(BIRD, zone.bird, {
              height: bank.rows * TILE,
              width: bank.cols * TILE,
              x: bank.col * TILE,
              y: bank.row * TILE,
            }),
          ).toBe(true);
          approachTicks = ticks + 1;
          approachEnd = zone;
          phase = 1;
          phaseTicks = -1;
        }
      }
    }
    expect(
      zone.death,
      JSON.stringify({ id, ticks, x: zone.bird.x, y: zone.bird.y }),
    ).toBeUndefined();
    expect(
      zone.cleared,
      JSON.stringify({ carried, id, index, ticks, x: zone.bird.x, y: zone.bird.y }),
    ).toBe(true);
    if (id === "outdoor-lift-ascent") {
      expect(approachEnd).toBeDefined();
      expect(approachTicks).toBeLessThanOrEqual(600);
      expect(phaseTicks).toBeLessThanOrEqual(600);
      expect(zone.seconds).toBeGreaterThan(approachEnd!.seconds);
      console.info("Blue lift phase ticks", {
        approach: approachTicks,
        boardingThroughExit: phaseTicks,
        total: ticks,
      });
      expect(boardedAt).toBeDefined();
      expect(carried).toBeGreaterThan(0);
    }
  },
);

it("connects Countryside lower terraces and the timed upper bank without moving its opening", () => {
  for (const stage of ["farmland", "country-lanes", "river-crossing"]) {
    const recipe = RECIPES[stage]!;
    if ("sections" in recipe) {
      throw Error("Expected continuous Countryside stage");
    }
    for (const id of [...recipe.chunks!, recipe.start, recipe.finish]) {
      expect(chunkProblems(CHUNK_LIBRARY, CATALOGUE, CHUNKS[id]!), id).toEqual([]);
      expect(CHUNKS[id]!.rows).toBe(FOUR_SCREEN_ROWS);
    }
    const original = CHUNKS[`${stage}-start`]!;
    const start = CHUNKS[countrysideVerticalId(`${stage}-start`)]!;
    expect(start.objects).toEqual(original.objects);
    expect(start.slots).toEqual(original.slots);
    expect(start.entry).toEqual(original.entry);
  }
  const recipe = RECIPES["river-crossing"]!;
  if ("sections" in recipe) {
    throw Error("Expected continuous Countryside stage");
  }
  const plan = assembleZone(CHUNK_LIBRARY, 1, "river-crossing", recipe);
  const ids = plan.areas.main!.chunks!.map(({ chunk }) => chunk);
  expect(ids[1]).toBe("outdoor-descent");
  expect(ids.at(-2)).toBe("outdoor-surface-return");
  for (const id of COUNTRYSIDE_CONNECTORS.filter(
    (id) => id.includes("ascent") && !id.includes("deep"),
  )) {
    expect(ids).toContain(id);
  }
});

it("boards, rides and leaves the upper bank ferry from the actual approach phase", () => {
  const id = "outdoor-ferry-ascent";
  const chunk = CHUNKS[id]!;
  const plan = zonePlanOf(CHUNK_LIBRARY, () => 0, { door: [], event: [] }, "farmland", 2, [id]);
  const layout = zoneLayout(TILE, BIRD_FRAME, CATALOGUE, HITBOXES, TILESETS, new Set(), plan);
  const area = layout.areas.main!;
  const moverIndex = area.objects.findIndex(({ collision }) => collision === "ledge");
  const mover = area.objects[moverIndex]!;
  const bank = chunk.solids[1]!;
  const targets = [bank, ...chunk.solids.slice(3)];
  let zone = startZone(BIRD, layout, 1);
  let index = 0;
  let jumpAt: number | undefined;
  let phase = 0;
  let phaseTicks = 0;
  let approachTicks: number | undefined;
  let approachEnd: ZoneState | undefined;
  let boardingX: number | undefined;
  let carried = 0;
  let transferring = false;
  let ticks = 0;
  for (; phaseTicks < 600 && !zone.death && !zone.cleared; ticks++, phaseTicks++) {
    const target = targets[index];
    const feet = zone.bird.y + BIRD.height;
    const at = zone.objects[moverIndex]!;
    let move: -1 | 0 | 1 = 1;
    let held = false;
    if (
      target &&
      zone.bird.grounded &&
      Math.abs(feet - target.row * TILE) < 0.01 &&
      zone.bird.x >= target.col * TILE
    ) {
      index++;
      jumpAt = undefined;
    } else if (target) {
      if (index === 1) {
        if (
          zone.bird.grounded &&
          standsOn(BIRD, zone.bird, { ...at, height: mover.height, width: mover.width })
        ) {
          boardingX ??= at.x;
          carried = Math.max(carried, at.x - boardingX);
          move = 0;
          jumpAt = undefined;
          if (
            target.col * TILE - zone.bird.x - BIRD.width <= (REACH.gap * TILE) / 2 &&
            carried > 0
          ) {
            transferring = true;
            jumpAt = ticks;
            move = 1;
          }
        } else if (!transferring && jumpAt === undefined) {
          const hold = (bank.col + bank.cols) * TILE - BIRD.width - TILE;
          if (zone.bird.x >= hold) {
            move = 0;
            if (phase === 1 && at.x - zone.bird.x - BIRD.width <= REACH.gap * TILE * 0.75) {
              jumpAt = ticks;
              move = 1;
            }
          }
        }
      } else if (zone.bird.grounded && feet > target.row * TILE) {
        jumpAt ??= ticks;
      }
      held = jumpAt !== undefined && (ticks - jumpAt) * STEP_SECONDS < BIRD.jumpRiseTime;
    }
    zone = stepZone(BIRD, layout, STEP_SECONDS, { jumpHeld: held, move, useHeld: false }, zone);
    if (phase === 0 && index === 1 && zone.bird.grounded && zone.bird.vx === 0) {
      expect(
        standsOn(BIRD, zone.bird, {
          height: bank.rows * TILE,
          width: bank.cols * TILE,
          x: bank.col * TILE,
          y: bank.row * TILE,
        }),
      ).toBe(true);
      approachTicks = ticks + 1;
      approachEnd = zone;
      phase = 1;
      phaseTicks = -1;
    }
  }
  expect(
    zone.death,
    JSON.stringify({ index, ticks, x: zone.bird.x, y: zone.bird.y }),
  ).toBeUndefined();
  expect(
    zone.cleared,
    JSON.stringify({ carried, index, ticks, x: zone.bird.x, y: zone.bird.y }),
  ).toBe(true);
  expect(approachEnd).toBeDefined();
  expect(approachTicks).toBeLessThanOrEqual(600);
  expect(phaseTicks).toBeLessThanOrEqual(600);
  expect(zone.seconds).toBeGreaterThan(approachEnd!.seconds);
  expect(boardingX).toBeDefined();
  expect(carried).toBeGreaterThan(0);
  console.info("Countryside ferry phase ticks", {
    approach: approachTicks,
    boardingThroughExit: phaseTicks,
    total: ticks,
  });
});

it("keeps Woodland canopy pools connected and preserves authored depth planes", () => {
  for (const stage of ["forest-paths", "deep-woods", "ravine"]) {
    const recipe = RECIPES[stage]!;
    if ("sections" in recipe) {
      throw Error("Expected continuous Woodland stage");
    }
    for (const id of [...recipe.chunks!, recipe.start, recipe.finish]) {
      expect(chunkProblems(CHUNK_LIBRARY, CATALOGUE, CHUNKS[id]!), id).toEqual([]);
      expect(CHUNKS[id]!.rows).toBe(FOUR_SCREEN_ROWS);
    }
    expect(CHUNKS[recipe.start]!.objects).toEqual(CHUNKS[`${stage}-start`]!.objects);
    expect(CHUNKS[recipe.start]!.slots).toEqual(CHUNKS[`${stage}-start`]!.slots);
  }
  for (const [id, tallId] of Object.entries(WOODLAND_VERTICAL_ALIASES)) {
    const oldId = WOODLAND_DEPTH_ALIASES[id];
    if (!oldId) {
      continue;
    }
    const before = CHUNKS[oldId]!;
    const after = CHUNKS[tallId]!;
    const weakLayers = (chunk: typeof before) =>
      (chunk.backdrops ?? []).filter(({ parallax }) => parallax && parallax.y < 1);
    expect(weakLayers(after)).toEqual(weakLayers(before));
    expect(after.scenery!.map(({ character }) => character)).toEqual(
      (before.scenery ?? []).map(({ character }) => character),
    );
    for (const [index, instance] of after.scenery!.entries()) {
      const original = before.scenery![index]!;
      expect(instance.parallax).toEqual(original.parallax);
      if (original.parallax?.y !== undefined && original.parallax.y < 1) {
        expect(instance.row).toBe(original.row);
      }
      if (original.parallax?.y === 1 && instance.character !== "background-swallow") {
        const character = CHUNK_LIBRARY.characters[instance.character]!;
        expect(
          after.solids.some(
            (solid) =>
              solid.row === instance.row + character.rows &&
              solid.col <= instance.col &&
              solid.col + solid.cols >= instance.col + character.cols,
          ),
        ).toBe(true);
      }
    }
  }
  const recipe = RECIPES.ravine!;
  if ("sections" in recipe) {
    throw Error("Expected continuous Woodland stage");
  }
  const plan = assembleZone(CHUNK_LIBRARY, 1, "ravine", recipe);
  const ids = plan.areas.main!.chunks!.map(({ chunk }) => chunk);
  expect(ids[1]).toBe("woodland-timed-descent");
  expect(ids.at(-2)).toBe("woodland-timed-return");
  for (const id of ["outdoor-lift-ascent", "outdoor-upper-ascent"]) {
    expect(ids).toContain(id);
  }
  expect(recipe.start).toBe(woodlandVerticalId("ravine-start"));
});

it.each(["woodland-timed-descent", "woodland-deep-ascent"])(
  "crosses %s using an ordinary jump and an observed gate phase",
  (id) => {
    const chunk = CHUNKS[id]!;
    const plan = zonePlanOf(CHUNK_LIBRARY, () => 0, { door: [], event: [] }, "forest-paths", 2, [
      id,
    ]);
    const layout = zoneLayout(TILE, BIRD_FRAME, CATALOGUE, HITBOXES, TILESETS, new Set(), plan);
    const area = layout.areas.main!;
    const guardIndex = area.objects.findIndex(({ collision }) => collision === "hazard");
    const guard = area.objects[guardIndex]!;
    let zone = startZone(BIRD, layout, 1);
    let index = 1;
    let jumpAt: number | undefined;
    let passed = false;
    let ticks = 0;
    for (; ticks < 600 && !zone.death && !zone.cleared; ticks++) {
      const target = chunk.solids[index];
      const feet = zone.bird.y + BIRD.height;
      let move: -1 | 0 | 1 = 1;
      let held: boolean;
      if (
        target &&
        zone.bird.grounded &&
        Math.abs(feet - target.row * TILE) < 0.01 &&
        zone.bird.x >= target.col * TILE
      ) {
        index++;
        jumpAt = undefined;
      } else if (target && zone.bird.grounded && feet > target.row * TILE) {
        jumpAt ??= ticks;
      }
      held = jumpAt !== undefined && (ticks - jumpAt) * STEP_SECONDS < BIRD.jumpRiseTime;
      const support = chunk.solids.find(
        (solid) =>
          Math.abs(feet - solid.row * TILE) < 0.01 &&
          solid.col * TILE <= zone.bird.x &&
          (solid.col + solid.cols) * TILE > zone.bird.x,
      );
      const supportRight = support ? (support.col + support.cols) * TILE : 0;
      if (
        !passed &&
        zone.bird.grounded &&
        support &&
        guard.origin.x - supportRight <= BIRD.width + TILE &&
        zone.bird.x >= Math.min(guard.origin.x, supportRight) - BIRD.width - TILE
      ) {
        const at = zone.objects[guardIndex]!;
        move = 0;
        held = false;
        jumpAt = undefined;
        if (at.y <= guard.origin.y + guard.behaviour!.distance + 0.01) {
          passed = true;
          move = 1;
        }
      }
      zone = stepZone(BIRD, layout, STEP_SECONDS, { jumpHeld: held, move, useHeld: false }, zone);
    }
    expect(
      zone.death,
      JSON.stringify({ id, ticks, x: zone.bird.x, y: zone.bird.y }),
    ).toBeUndefined();
    expect(zone.cleared, JSON.stringify({ id, index, ticks, x: zone.bird.x, y: zone.bird.y })).toBe(
      true,
    );
    expect(passed).toBe(true);
  },
);

it("connects Home city lower climbing yards through the proven lift and upper gate", () => {
  for (const stage of ["city-outskirts", "back-streets", "familiar-neighbourhood"]) {
    const recipe = RECIPES[stage]!;
    if ("sections" in recipe) {
      throw Error("Expected continuous Home city stage");
    }
    expect(recipe.rows).toBe(FOUR_SCREEN_ROWS);
    for (const id of [...recipe.chunks!, recipe.start, recipe.finish]) {
      expect(chunkProblems(CHUNK_LIBRARY, CATALOGUE, CHUNKS[id]!), id).toEqual([]);
    }
    expect(CHUNKS[recipe.start]!.objects).toEqual(CHUNKS[`${stage}-start`]!.objects);
    expect(CHUNKS[recipe.start]!.slots).toEqual(CHUNKS[`${stage}-start`]!.slots);
    expect(recipe.start).toBe(homeVerticalId(`${stage}-start`));
  }
  for (const id of HOME_CONNECTORS.filter((id) => id.startsWith("home-"))) {
    const original = CHUNKS[id.replace("home-", "woodland-")]!;
    expect(CHUNKS[id]!.objects).toBe(original.objects);
    expect(CHUNKS[id]!.solids).toBe(original.solids);
  }
  const recipe = RECIPES["familiar-neighbourhood"]!;
  if ("sections" in recipe) {
    throw Error("Expected continuous Home city stage");
  }
  const plan = assembleZone(CHUNK_LIBRARY, 1, "familiar-neighbourhood", recipe);
  const ids = plan.areas.main!.chunks!.map(({ chunk }) => chunk);
  expect(ids[1]).toBe("home-timed-descent");
  expect(ids.at(-2)).toBe("home-timed-return");
  expect(ids).toContain("outdoor-lift-ascent");
  expect(ids).toContain("outdoor-upper-ascent");
});

it("climbs the four-screen Apartment opening with continuous ordinary phase carry", () => {
  const original = zonePlanOf(
    CHUNK_LIBRARY,
    () => 0,
    { door: [], event: [] },
    "apartment-lobby",
    2,
    ["apartment-floor-start"],
  );
  const plan = {
    ...original,
    areas: {
      ...original.areas,
      main: {
        ...original.areas.main!,
        entries: { ...original.areas.main!.entries, start: { col: 2, row: APARTMENT_SPAWN_ROW } },
      },
    },
  };
  const layout = zoneLayout(TILE, BIRD_FRAME, CATALOGUE, HITBOXES, TILESETS, new Set(), plan);
  let zone = startZone(BIRD, layout, 1);
  const phases = [
    [
      ...APARTMENT_LOWER_SHELVES.map(({ col, cols, row }) => ({
        col: col + cols / 2 - BIRD.width / TILE / 2,
        row,
      })),
      { col: 1, row: 80 },
    ],
    [
      { col: 7, row: 75 },
      { col: 16, row: 70 },
      { col: 21, row: 65 },
      { col: 26, row: 60 },
      { col: 31, row: 55 },
      { col: 37, row: 50 },
    ],
  ];
  const counts: number[] = [];
  for (const points of phases) {
    const startSteps = zone.steps;
    let target = 0;
    let jumpAt = -1000;
    let previousHeld = false;
    let tick = 0;
    for (; tick < 600 && !zone.death && target < points.length; tick++) {
      const goal = points[target]!;
      const feet = zone.bird.y + BIRD.height;
      if (
        zone.bird.grounded &&
        Math.abs(feet - goal.row * TILE) < 0.1 &&
        Math.abs(zone.bird.x - goal.col * TILE) < TILE
      ) {
        target++;
        previousHeld = false;
        continue;
      }
      if (zone.bird.grounded && !previousHeld) {
        jumpAt = tick;
      }
      const held = (tick - jumpAt) * STEP_SECONDS < BIRD.jumpRiseTime;
      const dx = goal.col * TILE - zone.bird.x;
      const brake = (zone.bird.vx * Math.abs(zone.bird.vx)) / (2 * BIRD.brakeAccel);
      const move: -1 | 0 | 1 = Math.abs(dx - brake) < 1 ? 0 : dx - brake > 0 ? 1 : -1;
      zone = stepZone(BIRD, layout, STEP_SECONDS, { jumpHeld: held, move, useHeld: false }, zone);
      previousHeld = held;
    }
    counts.push(zone.steps - startSteps);
    expect(zone.steps - startSteps).toBeLessThanOrEqual(600);
    expect(zone.death, JSON.stringify({ bird: zone.bird, counts, target })).toBeUndefined();
    expect(target, JSON.stringify({ bird: zone.bird, counts, target })).toBe(points.length);
    expect(zone.bird.grounded).toBe(true);
    expect(zone.bird.airJumpUsed).toBe(false);
    expect(zone.bird.dash?.airUsed).not.toBe(true);
  }
  expect(zone.bird.y + BIRD.height).toBe(50 * TILE);
  expect(zone.steps).toBe(counts.reduce((sum, count) => sum + count, 0));
});
