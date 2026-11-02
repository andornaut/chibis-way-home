import { describe, expect, it } from "vitest";

import { TILE } from "../data/screen";
import { zoneLayout } from "../rules/tiles";
import { BIRD_FRAME } from "../view/bird";
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
      chunkWalkPlan(subject),
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
