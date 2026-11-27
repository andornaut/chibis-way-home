import { mkdirSync, writeFileSync } from "node:fs";

import { expect, it, vi } from "vitest";

import { traceRecorder } from "../ai/index.ts";
import { BIRD } from "../data/bird.ts";
import { ROOM_BUILDINGS } from "../data/roomBuildings.ts";
import { ROOMS } from "../data/rooms.ts";
import { planStage, requirePlanned, STAGE_CONTEXT } from "../rules/stage/index.ts";
import {
  arenaApproachContext,
  coldEncounterConfig,
  coldEncounterFacts,
  firstArenaEncounter,
} from "../testing/arenaApproaches.ts";
import { TRACE } from "../testing/behaviourTraceHook.ts";
import { hashOf } from "../testing/pairCertify.ts";
import { nodeArt, preparedPlan, simulateStage } from "./index.ts";

vi.mock("../rules/zone/zone.ts", async (original) =>
  (await import("../testing/behaviourTraceHook.ts")).tracedZone(await original()),
);

const selected = process.env.CITY_GIFT_CASE;
const dump = process.env.BEHAVIOUR_TRACE_DUMP;
const gifts = [...Object.keys(ROOMS).filter((room) => ROOMS[room]?.grant !== undefined), null];
const buildings = new Set<string>(Object.values(ROOM_BUILDINGS));
const art = nodeArt();
function prepare(giftRoom?: string | null) {
  const { plan } = requirePlanned(
    planStage(STAGE_CONTEXT, {
      avoid: [],
      seed: 2,
      target: { recipe: "city-boundary" },
      ...(giftRoom === undefined ? {} : { giftRoom }),
    }),
  );
  return preparedPlan({ ...art, seed: 2 }, plan);
}
const baseline = prepare();
function physical(stage: typeof baseline) {
  return {
    ...stage.layout,
    areas: Object.fromEntries(
      Object.entries(stage.layout.areas).map(([key, area]) => [
        key,
        {
          ...area,
          objects: area.objects.filter(
            (object) => object.room === undefined && !buildings.has(object.character),
          ),
        },
      ]),
    ),
  };
}

it("preserves City's ordinary physical context for all three gift rooms and no gift", () => {
  expect(gifts).toHaveLength(4);
  const encounter = firstArenaEncounter(baseline);
  const variants = gifts.map((giftRoom) => {
    const stage = prepare(giftRoom);
    expect(stage.source?.chunkIds).toEqual(baseline.source?.chunkIds);
    expect(physical(stage)).toEqual(physical(baseline));
    expect(firstArenaEncounter(stage)).toEqual(encounter);
    const doors = Object.values(stage.layout.areas).flatMap((area) =>
      area.objects.filter((object) => object.room !== undefined),
    );
    expect(doors.map((door) => door.room)).toEqual(giftRoom === null ? [] : [giftRoom]);
    return {
      giftRoom,
      ...arenaApproachContext({ encounter, hash: hashOf }, stage),
      provenance: stage.source?.provenance,
    };
  });
  expect(new Set(variants.map((variant) => variant.plan)).size).toBe(4);
  if (dump !== undefined) {
    mkdirSync(dump, { recursive: true });
    writeFileSync(`${dump}/preflight.json`, `${JSON.stringify(variants, null, 2)}\n`);
  }
});

// Explicit, one-case qualification only. The scheduled suite keeps its canonical City case.
it.skipIf(selected === undefined)(
  "qualifies one selected changed City gift context with the canonical cold-encounter controls",
  () => {
    const giftRoom = selected === "none" ? null : selected;
    expect(gifts).toContain(giftRoom);
    expect(dump).toBeDefined();
    const stage = prepare(giftRoom);
    const encounter = firstArenaEncounter(stage);
    expect(physical(stage)).toEqual(physical(baseline));
    expect(firstArenaEncounter(stage)).toEqual(firstArenaEncounter(baseline));
    expect(hashOf(stage.layout)).not.toBe(hashOf(baseline.layout));
    const recorder = traceRecorder({ retain: true });
    TRACE.active = recorder;
    let result: ReturnType<typeof simulateStage>;
    try {
      result = simulateStage(BIRD, stage, coldEncounterConfig(encounter));
    } finally {
      TRACE.active = undefined;
      mkdirSync(dump!, { recursive: true });
      writeFileSync(`${dump}/${selected}.trace`, `${recorder.lines()!.join("\n")}\n`);
    }
    writeFileSync(`${dump}/${selected}.result.json`, `${JSON.stringify(result, null, 2)}\n`);
    expect(recorder.ticks()).toBeGreaterThan(0);
    expect(coldEncounterFacts(encounter, result)).toEqual({
      arenaVisited: true,
      attacked: true,
      pursued: true,
      traceRetained: true,
    });
  },
  180_000,
);
