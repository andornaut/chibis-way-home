import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { expect, it } from "vitest";

import type { ZonePlan } from "../data/types/index.ts";
import { STAGE_RECIPES, zonePlanAvoiding, zonePlanFor } from "./zonePlans.ts";

// Pins every recipe's assembled plan: a refactor of stage planning keeps each hash. Update the
// fixture only with a deliberate change to the chunks, recipes or assembly.
const FIXTURE = new URL("./zonePlans.golden.json", import.meta.url);
const SEEDS = Array.from({ length: 16 }, (_, seed) => seed);

interface RecipeHashes {
  readonly avoiding: readonly string[];
  readonly whole: readonly string[];
}

const GOLDEN = JSON.parse(readFileSync(FIXTURE, "utf8")) as Readonly<Record<string, RecipeHashes>>;

// value as JSON with every object's keys in order, so the hash follows content alone.
function stable(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stable).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const fields = Object.entries(value)
      .filter(([, field]) => field !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : 1));
    return `{${fields.map(([key, field]) => `${JSON.stringify(key)}:${stable(field)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

// The hash of the plan assemble returns, or the message it throws.
function planHash(assemble: () => ZonePlan): string {
  try {
    return createHash("sha256").update(stable(assemble())).digest("hex").slice(0, 16);
  } catch (error) {
    return `throws: ${(error as Error).message}`;
  }
}

// The placed chunks of plan between each area's first and last.
function middleOf(plan: ZonePlan): readonly string[] {
  return Object.values(plan.areas).flatMap((area) =>
    (area.chunks ?? []).slice(1, -1).map(({ chunk }) => chunk),
  );
}

it("pins a hash for every stage recipe", () => {
  expect(Object.keys(GOLDEN)).toEqual(Object.keys(STAGE_RECIPES).sort());
});

it.each(Object.keys(STAGE_RECIPES).sort())(
  "assembles %s as recorded for each seed, with and without avoided chunks",
  (key) => {
    const avoid = middleOf(zonePlanFor(0, key));
    expect({
      avoiding: SEEDS.map((seed) => planHash(() => zonePlanAvoiding(avoid, seed, key))),
      whole: SEEDS.map((seed) => planHash(() => zonePlanFor(seed, key))),
    }).toEqual(GOLDEN[key]);
  },
  120_000,
);
