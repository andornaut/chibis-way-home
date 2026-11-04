import { describe, expect, it } from "vitest";

import { BIRD_FRAME } from "../assets";
import { TILE } from "../data/screen";
import { APARTMENT_SPAWN_ROW } from "../data/zone6";
import { zoneLayout } from "../rules/tiles";
import { ALL_CHUNKS } from "./chunks";
import { CHUNK_WALK_EQUIVALENTS, chunkWalkPhysics, chunkWalkPlan } from "./chunkWalkCases";
import { FILLED_CHUNK_SLOTS, REQUIRED_CHUNK_ROUTES } from "./requiredRoutes";
import { CATALOGUE, HITBOXES, TILESETS } from "./walkSuite";

const byName = new Map(ALL_CHUNKS.map((entry) => [entry[0], entry]));

describe("standalone empty-slot physical equivalents", () => {
  it.each(Object.entries(CHUNK_WALK_EQUIVALENTS))(
    "%s retains the walk inputs of %s",
    (name, representative) => {
      const subject = byName.get(name);
      const original = byName.get(representative);
      expect(subject, "missing candidate").toBeDefined();
      expect(original, "missing representative").toBeDefined();
      expect(
        CHUNK_WALK_EQUIVALENTS[representative],
        "representative retains its own walk",
      ).toBeUndefined();
      expect(name.startsWith("fixture ")).toBe(representative.startsWith("fixture "));
      expect(REQUIRED_CHUNK_ROUTES[name]).toEqual(REQUIRED_CHUNK_ROUTES[representative]);
      expect(FILLED_CHUNK_SLOTS[name]).toEqual(FILLED_CHUNK_SLOTS[representative]);
      expect(chunkWalkPhysics(subject!)).toEqual(chunkWalkPhysics(original!));
    },
  );

  it("retains the complete resolved hazard and terrain inputs rather than only their painted shape", () => {
    const subject = byName.get("fixture test-flat-40")!;
    const layout = zoneLayout(
      TILE,
      BIRD_FRAME,
      CATALOGUE,
      HITBOXES,
      TILESETS,
      new Set(),
      chunkWalkPlan({ door: [], event: [] }, subject),
    );
    const hazards = layout.areas.main!.objects.filter((object) => object.collision === "hazard");
    expect(hazards).not.toHaveLength(0);
    expect(chunkWalkPhysics(subject)).toMatchObject({
      areas: {
        main: { objects: expect.arrayContaining(hazards), solids: layout.areas.main!.solids },
      },
    });
  });
});

it("keeps autonomous Woodland motion distinct from the same terrain without wildlife", () => {
  const name = "compound-low-ceiling-shuttle-woodland-depth";
  expect(CHUNK_WALK_EQUIVALENTS[name]).toBeUndefined();
  expect(chunkWalkPhysics(byName.get(name)!)).not.toEqual(
    chunkWalkPhysics(byName.get("compound-low-ceiling-shuttle-exterior")!),
  );
});

it.each(["empty", "filled"] as const)(
  "starts the %s opening profile on its production spawn without changing the seam",
  (profile) => {
    const subject = byName.get("apartment-floor-start")!;
    const fills = profile === "filled" ? FILLED_CHUNK_SLOTS[subject[0]]! : { door: [], event: [] };
    const plan = chunkWalkPlan(fills, subject);
    expect(plan.areas[plan.start.area]!.entries[plan.start.entry]!.row).toBe(APARTMENT_SPAWN_ROW);
    const geometry = (solids: (typeof subject)[2]["solids"]) =>
      solids.map(({ col, cols, row, rows }) => ({ col, cols, row, rows }));
    expect(geometry(plan.areas[plan.start.area]!.solids)).toEqual(geometry(subject[2].solids));
    expect(subject[2].entry.row).not.toBe(APARTMENT_SPAWN_ROW);
    const middle = byName.get("apartment-tall-compound-patrol-lift")!;
    const middlePlan = chunkWalkPlan({ door: [], event: [] }, middle);
    expect(middlePlan.areas[middlePlan.start.area]!.entries[middlePlan.start.entry]!.row).toBe(
      middle[2].entry.row,
    );
  },
);
