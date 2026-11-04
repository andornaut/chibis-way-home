import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { expect, it } from "vitest";

import { canonicalTrace, traceRecorder } from "../ai/trace";
import { BIRD } from "../data/bird";
import { TILE } from "../data/screen";
import { CATALOGUE, HITBOXES, TILESETS } from "../testing/walkSuite";
import { BIRD_FRAME } from "../view/bird";
import { zonePlanOf } from "./assemble";
import { startBird } from "./bird";
import { STEP_SECONDS } from "./step";
import { zoneLayout } from "./tiles";
import { activateBehaviour, startZone, stepZone } from "./zone";
import { CHUNK_LIBRARY } from "./zonePlans";

// Chibi stands beside each boss on its own floor, so growls push him and throws, traps and
// shots spawn. Each run's pulses, transients and Chibi hash to the value recorded before entry
// effects moved into abilities. BEHAVIOUR_TRACE_UPDATE=1 re-records.
const FIXTURE = new URL("./fixtures/behaviourEffectTraces.json", import.meta.url);
const UPDATE = process.env.BEHAVIOUR_TRACE_UPDATE === "1";
const CHUNKS = [
  ["growl-clearing", "deep-woods"],
  ["growl-cover-early", "deep-woods"],
  ["flyer-shelter-early", "loading-yards"],
  ["apartment-tall-city-boundary-climb-yard", "apartment-lobby"],
  ["city-boundary-climb-yard", "farmland"],
] as const;
const STILL = { jumpHeld: false, move: 0, useHeld: false } as const;

function run(id: string, theme: string, offset: number) {
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
  const names = new Map(objects.map((object, index) => [object as object, `object:${index}`]));
  const recorder = traceRecorder({ retain: false });
  let effects = 0;
  for (let tick = 0; tick < 900 && !zone.death; tick++) {
    zone = stepZone(BIRD, layout, STEP_SECONDS, STILL, zone);
    effects += zone.pulses.length + zone.transients.length;
    recorder.record(
      canonicalTrace(
        (value) =>
          names.get(value) ??
          ("character" in value && "art" in value
            ? `layout:${String(value.character)}`
            : undefined),
        { bird: zone.bird, pulses: zone.pulses, transients: zone.transients },
      ),
    );
  }
  return { effects, hash: recorder.hash() };
}

it("reproduces each boss's recorded entry effects on its own floor", () => {
  const baseline: Readonly<Record<string, string>> = existsSync(FIXTURE)
    ? (JSON.parse(readFileSync(FIXTURE, "utf8")) as Record<string, string>)
    : {};
  const observed: Record<string, string> = {};
  let effects = 0;
  for (const [id, theme] of CHUNKS) {
    for (const offset of [-6, -3, 3, 6]) {
      const name = `${id} ${theme} ${offset}`;
      const result = run(id, theme, offset);
      observed[name] = result.hash;
      effects += result.effects;
    }
  }
  if (UPDATE) {
    writeFileSync(FIXTURE, `${JSON.stringify(observed, null, 2)}\n`);
  } else {
    expect(observed).toEqual(baseline);
  }
  expect(effects).toBeGreaterThan(0);
}, 600_000);
