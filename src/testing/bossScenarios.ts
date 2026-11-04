import type { ObjectLayout, ZoneLayout } from "../data/types";
import { startBird } from "../rules/bird";
import { STEP_SECONDS } from "../rules/step";
import type { ZoneInput } from "../rules/zone";
import {
  type BossController,
  type BossCoverage,
  type BossScenario,
  botChibi,
  scriptedChibi,
} from "../sim/bossSimulator";
import { DIAGNOSTIC_SKILL, FORWARD_POLICY } from "../sim/bot";
import {
  chunkLayout,
  chunksLayout,
  ENCOUNTER_SCRIPTS,
  ENCOUNTER_TICKS,
  liftLayout,
  liftLowerDockStart,
  ORDINARY,
  withInstances,
} from "./encounterLayouts";

// Boss scenarios: regressions from past failures, then one scenario per boss. Scenarios named
// encounter use the encounter traces' chunk layout, scripts, tick budget and seed.

const scripted = (script: string) => () => scriptedChibi(ENCOUNTER_SCRIPTS[script]!);

// An encounter trace scenario.
function encounter(id: string, theme: string, script: string): BossScenario {
  return {
    controller: scripted(script),
    layout: () => chunkLayout(theme, id),
    name: `encounter ${id} ${theme} ${script}`,
    seed: 1,
    ticks: ENCOUNTER_TICKS,
  };
}

const STILL: ZoneInput = { jumpHeld: false, move: 0, useHeld: false };

// Waits on the lower dock until the lift docks, walks aboard and rides, as the lift's
// forced-transit test does. Each new attempt starts over.
function boardLift(layout: ZoneLayout): BossController {
  const objects = layout.areas.main!.objects;
  const lift = objects.findIndex(({ forcedTransit }) => forcedTransit);
  const lower = objects[lift]!.forcedTransit!.banks.find(({ id }) => id === "lower")!;
  const dock = objects[lift]!.origin;
  let attempt = -1;
  let phase: "aboard" | "board" | "wait" = "wait";
  return (_, zone) => {
    if (zone.attempt !== attempt) {
      attempt = zone.attempt;
      phase = "wait";
    }
    if (phase === "wait" && zone.bird.grounded && zone.objects[lift]!.y === dock.y) {
      phase = "board";
    }
    if (phase === "board" && zone.bird.x >= lower.x + lower.width) {
      phase = "aboard";
    }
    return phase === "board" ? { ...STILL, move: 1 } : STILL;
  };
}

// Pebble perched on the upper exit floor above the certified lift, with Chibi boarding at the
// lower dock: a synthetic placement, since no catalogued stage pairs Pebble with this lift.
const LIFT_PEBBLE: BossScenario = {
  controller: (_, layout) => boardLift(layout),
  layout: () => liftLayout([{ character: "pigeon-antagonist", col: 50, row: 36 }]),
  name: "lift pebble lower-dock board",
  seed: 1,
  start: (layout, zone) => liftLowerDockStart(layout)(zone),
  ticks: ENCOUNTER_TICKS,
};

// The reactive forward bot through chunks in one theme, with its own seed.
function botEncounter(theme: string, ids: readonly string[], seed: number): BossScenario {
  return {
    controller: (tuning, layout) =>
      botChibi(tuning, layout, DIAGNOSTIC_SKILL, FORWARD_POLICY, seed),
    layout: () => chunksLayout(theme, ids),
    name: `bot ${ids.join("+")} ${theme} seed ${seed}`,
    seed,
    ticks: ENCOUNTER_TICKS,
  };
}

// Archie on the crumbling crossing's ledge over the red pit: both banks are twelve tiles from
// the ledge, beyond a ground boss's jump. Only Chibi's landing cracks it, so Chibi drops onto
// the ledge's left lip, clear of Archie, then jumps back to the left bank; the ledge then gives
// way and Archie dies in the red pit. A synthetic placement.
const LIP = 24;
const JUMP_TICKS = Math.ceil(ORDINARY.jumpRiseTime / STEP_SECONDS);

// Waits to land on the lip, then jumps left and runs until it lands again; each new attempt
// stands still.
function lipLeap(): BossController {
  let attempt = -1;
  let launch: number | undefined;
  let airborne = false;
  let landed = false;
  return (tick, zone) => {
    if (zone.attempt !== attempt) {
      attempt = zone.attempt;
      launch = undefined;
      airborne = false;
      landed = false;
    }
    if (launch === undefined && attempt === 0 && zone.bird.grounded) {
      launch = tick;
    }
    if (launch !== undefined && tick > launch) {
      airborne ||= !zone.bird.grounded;
      landed ||= airborne && zone.bird.grounded;
    }
    const leaping = launch !== undefined && !landed;
    return {
      jumpHeld: leaping && tick - launch! < JUMP_TICKS,
      move: leaping ? -1 : 0,
      useHeld: false,
    };
  };
}

const CRUMBLING_ARCHIE: BossScenario = {
  controller: () => lipLeap(),
  layout: () =>
    chunksLayout(
      "city-streets",
      ["crumbling-support-crossing"],
      withInstances("crumbling-support-crossing", [
        { character: "dog-antagonist", col: 26, role: "antagonist", row: 44 },
      ]),
    ),
  name: "crumbling archie ledge chibi-trigger",
  seed: 1,
  start: (layout, zone) => {
    const ledge = layout.areas.main!.crumbling![0]!.supportId as ObjectLayout;
    // Feet a lip's height above the ledge, so Chibi lands on it.
    return {
      ...zone,
      bird: startBird(ORDINARY, {
        x: ledge.origin.x + LIP - ORDINARY.width,
        y: ledge.origin.y - LIP,
      }),
    };
  },
  ticks: ENCOUNTER_TICKS,
};

export interface BossScenarioGroup {
  readonly boss: string;
  readonly covers: readonly BossCoverage[];
  readonly scenario: BossScenario;
  // What the scenario regresses or covers.
  readonly subject: string;
}

export const BOSS_SCENARIOS: readonly BossScenarioGroup[] = [
  {
    boss: "Trixi",
    covers: ["tell", "attack"],
    scenario: encounter("city-boundary-climb-yard", "farmland", "still"),
    subject: "goose wall: Trixi below a jumpable wall",
  },
  {
    boss: "Trixi",
    covers: ["tell", "attack"],
    scenario: encounter("blue-vertical-city-boundary-climb-yard", "farmland", "still"),
    subject: "goose wall: blue vertical climb yard",
  },
  {
    boss: "Trixi",
    covers: ["tell", "attack"],
    scenario: encounter("countryside-vertical-city-boundary-climb-yard", "farmland", "pace"),
    subject: "goose wall: countryside vertical climb yard",
  },
  {
    boss: "Trixi",
    covers: ["tell", "attack"],
    scenario: botEncounter("farmland", ["city-boundary-climb-yard"], 5),
    subject: "goose wall: the reactive bot climbing past Trixi",
  },
  {
    boss: "Fert",
    covers: ["tell", "attack"],
    scenario: encounter("apartment-tall-city-boundary-climb-yard", "apartment-lobby", "still"),
    subject: "Fert underpass",
  },
  {
    boss: "Fert",
    covers: ["tell", "attack"],
    scenario: encounter("city-boundary-climb-yard", "apartment-lobby", "forward"),
    subject: "Fert underpass: crossing forward",
  },
  {
    boss: "Pebble",
    covers: ["tell", "attack"],
    scenario: encounter("flyer-shelter-early", "loading-yards", "still"),
    subject: "Pebble overhead crossing to a tell and an attack",
  },
  {
    boss: "Pebble",
    covers: [],
    scenario: encounter("dry-underground-gallery-encounter", "loading-yards", "pace"),
    subject: "Pebble overhead crossing in the gallery",
  },
  {
    boss: "Archie",
    covers: ["boss-death", "boss-on-crumbling"],
    scenario: CRUMBLING_ARCHIE,
    subject: "crumbling support: Chibi's landing cracks the ledge, dropping Archie to his death",
  },
  {
    boss: "Pebble",
    covers: ["deferred-window"],
    scenario: LIFT_PEBBLE,
    subject: "forced transit: targeted attacks deferred on the outdoor lift",
  },
  {
    boss: "Archie",
    covers: ["tell", "attack"],
    scenario: encounter("city-boundary-climb-yard", "city-streets", "pace"),
    subject: "Archie climb yard",
  },
  {
    boss: "Pebble",
    covers: ["tell", "attack"],
    scenario: encounter("bounded-flyer-post", "loading-yards", "still"),
    subject: "Pebble bounded post",
  },
  {
    boss: "Kiwi",
    covers: ["tell", "attack"],
    scenario: encounter("vertical-stack-early", "city-outskirts", "still"),
    subject: "Kiwi vertical yard",
  },
  {
    boss: "Bini",
    covers: ["tell", "attack"],
    scenario: encounter("growl-cover-early", "deep-woods", "still"),
    subject: "Bini growl yard",
  },
];
