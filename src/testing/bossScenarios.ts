import type { Property } from "../ai/agentProperties";
import { STEP_SECONDS } from "../core";
import { TILE } from "../data/screen";
import type { ObjectLayout, ZoneLayout } from "../data/types";
import { startBird } from "../rules/bird";
import type { ZoneInput } from "../rules/zone";
import { crossesAfterSettle } from "../sim/bossProperties";
import {
  type BossController,
  type BossCoverage,
  BOSSES,
  type BossScenario,
  type BossTick,
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

// Give-up, return and rearm: Chibi engages a boss beside cover it can jump, is placed at col 140
// (beyond the escape distance) so the boss gives up where it is, and is then placed past the
// cover. Both cover blocks in the patrol and growl yards rise six rows, within every ground
// boss's jump. Each yard leads into two boss-free chunks, so col 140 is on the far chunk's
// floor.
const REARM_CHUNKS = ["broad-mesa", "low-central-crossing"] as const;
// Chibi's placement past the cover.
const REARM_STAND_TICK = 900;
// The bound after Chibi's placement past the cover: up to two seconds for the next rearm probe
// (awareness returning, or a body width of patrol after an exhausted search), then the four
// seconds the idle recovery rule allows an engaged boss without horizontal progress.
const REARM_SECONDS = 6;

interface RearmPlacement {
  // Chibi's first column and feet row (the boss's floor by default), and the tick he leaves.
  readonly first: { readonly col: number; readonly row?: number };
  readonly leave?: number;
  readonly stand: number;
}

// Places Chibi's feet at each column from its tick on, standing still otherwise. Each run ends
// when the rearm bound does.
function rearmPlaced(
  theme: string,
  id: string,
  seed: number,
  { first, leave = 2, stand }: RearmPlacement,
): BossScenario {
  const layout = () => chunksLayout(theme, [id, ...REARM_CHUNKS]);
  const boss = layout().areas.main!.objects.find(({ character }) => character in BOSSES)!;
  const floor = boss.origin.y + boss.height;
  return {
    controller: () => () => STILL,
    layout,
    name: `rearm ${id} ${theme} ${first.col}/140/${stand} leaving at ${leave} seed ${seed}`,
    place: (tick) =>
      tick < leave
        ? { x: first.col * TILE, y: first.row === undefined ? floor : first.row * TILE }
        : tick === leave
          ? { x: 140 * TILE, y: floor }
          : tick === REARM_STAND_TICK
            ? { x: stand * TILE, y: floor }
            : undefined,
    seed,
    ticks: REARM_STAND_TICK + Math.round(REARM_SECONDS / STEP_SECONDS) + 1,
  };
}

const rearmChecks = (edgeCol: number) => (): readonly Property<BossTick>[] => [
  crossesAfterSettle(edgeCol * TILE, REARM_SECONDS, REARM_STAND_TICK),
];

interface BossScenarioGroup {
  readonly boss: string;
  // Scenario-specific checks beyond the boss properties.
  readonly checks?: (layout: ZoneLayout) => readonly Property<BossTick>[];
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
  {
    boss: "Archie",
    checks: rearmChecks(48),
    covers: [],
    scenario: rearmPlaced("city-streets", "patrol-cover-late", 1, {
      first: { col: 30 },
      stand: 54,
    }),
    subject: "rearm: Archie gives up on the late yard floor and rearms over the right block",
  },
  {
    boss: "Archie",
    checks: rearmChecks(24),
    covers: [],
    scenario: rearmPlaced("city-streets", "patrol-cover-late", 1, {
      first: { col: 30 },
      stand: 14,
    }),
    subject: "rearm: Archie gives up on the late yard floor and rearms over the left block",
  },
  {
    boss: "Archie",
    checks: rearmChecks(32),
    covers: [],
    scenario: rearmPlaced("city-streets", "patrol-cover-early", 1, {
      first: { col: 24 },
      stand: 38,
    }),
    subject: "rearm: Archie pinned against the early yard's low block rearms over the right block",
  },
  {
    boss: "Archie",
    checks: rearmChecks(40),
    covers: [],
    scenario: rearmPlaced("city-streets", "patrol-cover-middle", 1, {
      first: { col: 30 },
      stand: 46,
    }),
    subject: "rearm: Archie pinned against the middle yard's low block rearms over the right block",
  },
  {
    boss: "Archie",
    checks: rearmChecks(48),
    covers: [],
    scenario: rearmPlaced("city-streets", "city-boundary-dog-terrace", 1, {
      first: { col: 42 },
      stand: 54,
    }),
    subject: "rearm: Archie on the dog terrace rearms over the right block",
  },
  {
    boss: "Trixi",
    checks: rearmChecks(48),
    covers: ["limited-move"],
    scenario: rearmPlaced("country-lanes", "patrol-cover-late", 1, {
      first: { col: 30 },
      stand: 54,
    }),
    subject:
      "rearm: Trixi gives up on the late yard floor and rearms over the right block, sliding " +
      "after a rush",
  },
  {
    boss: "Fert",
    checks: rearmChecks(48),
    covers: [],
    scenario: rearmPlaced("apartment-lobby", "patrol-cover-late", 1, {
      first: { col: 30 },
      stand: 54,
    }),
    subject: "rearm: Fert gives up on the late yard floor and rearms over the right block",
  },
  {
    boss: "Fert",
    covers: [],
    scenario: rearmPlaced("apartment-lobby", "patrol-cover-late", 1, {
      first: { col: 50, row: 44 },
      leave: 230,
      stand: 14,
    }),
    subject:
      "give-up in the air: Fert gives up mid-climb onto the right block and lands before patrolling",
  },
  {
    boss: "Bini",
    checks: rearmChecks(48),
    covers: [],
    scenario: rearmPlaced("deep-woods", "growl-cover-late", 1, { first: { col: 30 }, stand: 54 }),
    subject: "rearm: Bini gives up on the late growl yard floor and rearms over the right block",
  },
];
