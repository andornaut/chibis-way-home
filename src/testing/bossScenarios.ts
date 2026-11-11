import type { Property } from "../ai/agentProperties";
import { STEP_SECONDS } from "../core";
import { DOG_BEHAVIOUR } from "../data/behaviours";
import { CHARACTERS } from "../data/characters";
import { TILE } from "../data/screen";
import type { AntagonistKind, Instance, ObjectLayout, ZoneLayout } from "../data/types";
import { startBird } from "../rules/bird";
import type { ZoneInput } from "../rules/zone";
import {
  committedHold,
  crossesAfterSettle,
  leavesSpawn,
  movesAtLeast,
  movesWhileEngaged,
  pacesNearest,
  risesToRow,
  tellPauseLasts,
} from "../sim/bossProperties";
import {
  type BossController,
  type BossCoverage,
  type BossScenario,
  type BossTick,
  botChibi,
  scriptedChibi,
} from "../sim/bossSimulator";
import { DIAGNOSTIC_SKILL, FORWARD_POLICY } from "../sim/bot";
import { sampleArenaCase } from "./arenas";
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

// Tell cap: Archie starts in his pounce chase on the open floor behind Chibi. Chibi stands until
// Archie tells, then runs on, hopping the floor steps, until that tell and any tell pause end.
// Every pounce tell ends with Chibi beyond the pounce range, so it cancels, and the second cancel
// starts the pause. A synthetic placement.
const DODGE_CHUNKS = ["low-central-crossing", "broad-mesa"];

function pounceDodger(layout: ZoneLayout): BossController {
  const index = layout.areas.main!.objects.findIndex(
    ({ character }) => character === "dog-antagonist",
  );
  const archie = layout.areas.main!.objects[index]!;
  return (tick, zone) => {
    const state = zone.behaviours[index];
    const at = zone.objects[index] ?? archie.origin;
    const gap = zone.bird.x + ORDINARY.width / 2 - (at.x + archie.width / 2);
    const run =
      state?.activeAttack?.phase === "tell" || (state?.tellPauseRemainingSeconds ?? 0) > 0;
    return {
      jumpHeld: run && tick % 60 < 30,
      move: run ? (gap < 0 ? -1 : 1) : 0,
      useHeld: false,
    };
  };
}

// Archie with the pounce as his only attack, so the dodger's cancels reach the tell pause.
const POUNCE_ONLY_ARCHIE = {
  ...DOG_BEHAVIOUR,
  initial: "pursuit",
  states: {
    ...DOG_BEHAVIOUR.states,
    pursuit: {
      ...DOG_BEHAVIOUR.states.pursuit!,
      transitions: DOG_BEHAVIOUR.states.pursuit!.transitions.filter(
        ({ to }) => to === "prepare-pounce",
      ),
    },
  },
};

const TELL_CAP_ARCHIE: BossScenario = {
  controller: (_, layout) => pounceDodger(layout),
  layout: () =>
    chunksLayout(
      "city-streets",
      DODGE_CHUNKS,
      withInstances("low-central-crossing", [
        {
          behaviour: POUNCE_ONLY_ARCHIE,
          character: "dog-antagonist",
          col: 38,
          role: "antagonist",
          row: 46,
        },
      ]),
    ),
  name: "tell cap archie pounce dodge",
  seed: 1,
  start: (_, zone) => ({
    ...zone,
    bird: startBird(ORDINARY, { x: 54 * TILE, y: 50 * TILE - ORDINARY.height }),
  }),
  ticks: 720,
};

// Each boss's admitted arena in its stage's theme, for the encounter scenarios.
const ARENAS = {
  Archie: { id: "arena-dog-city-boundary", theme: "city-boundary" },
  Bini: { id: "arena-bear-ravine", theme: "ravine" },
  Fert: { id: "arena-ferret-residential-floors", theme: "apartment-residential" },
  Kiwi: { id: "arena-raccoon-familiar-neighbourhood", theme: "familiar-neighbourhood" },
  Pebble: { id: "arena-pigeon-freight-terminal", theme: "freight-terminal" },
  Trixi: { id: "arena-goose-river-crossing", theme: "river-crossing" },
} as const;
type Boss = keyof typeof ARENAS;
const arenaEncounter = (boss: Boss, script: string) =>
  encounter(ARENAS[boss].id, ARENAS[boss].theme, script);

// Kiwi's second charge: Chibi steps behind Kiwi during her first rush and back to the entry
// during the re-aimed tell, so she turns with her whole track ahead and rushes again. Placements
// stand Chibi on Kiwi's floor. A synthetic placement.
const KIWI_BEHIND = { back: 186, behind: 130, col: 54 } as const;

function kiwiBehind(): BossScenario {
  const base = arenaEncounter("Kiwi", "still");
  const kiwi = base
    .layout()
    .areas.main!.objects.find(({ character }) => character === "raccoon-antagonist")!;
  const top = kiwi.origin.y + kiwi.height - ORDINARY.height;
  return {
    ...base,
    name: "kiwi second charge behind her",
    place: (tick) =>
      tick === KIWI_BEHIND.behind
        ? { x: KIWI_BEHIND.col * TILE, y: top }
        : tick === KIWI_BEHIND.back
          ? { x: 3 * TILE, y: top }
          : undefined,
    ticks: 600,
  };
}

// Each boss's sample arena: a floor, a deck six rows up and under it a nook every boss is too
// tall to enter, its two-row step from col 28 to col 38. Two boss-free chunks of the arena's
// height follow, so col 140 is on the far chunk's floor.
const SAMPLE_BOSSES: Readonly<Record<Boss, AntagonistKind>> = {
  Archie: "dog-antagonist",
  Bini: "bear-antagonist",
  Fert: "ferret-antagonist",
  Kiwi: "raccoon-antagonist",
  Pebble: "pigeon-antagonist",
  Trixi: "goose-antagonist",
};
const SAMPLE_FILLERS: Readonly<Record<Boss, string>> = {
  Archie: "blue-vertical",
  Bini: "woodland-vertical",
  Fert: "apartment-tall",
  Kiwi: "home-vertical",
  Pebble: "industrial-tunnel",
  Trixi: "countryside-vertical",
};
const NOOK = { left: 28, right: 38 } as const;

interface Sample {
  readonly floor: number;
  readonly layout: () => ZoneLayout;
  readonly name: string;
}

function sample(boss: Boss, extra: readonly Instance[] = []): Sample {
  const found = sampleArenaCase(SAMPLE_BOSSES[boss]);
  const id = found.arena.id;
  const library = extra.length > 0 ? withInstances(id, extra, found.library) : found.library;
  const fillers = ["broad-mesa", "low-central-crossing"].map(
    (base) => `${SAMPLE_FILLERS[boss]}-${base}`,
  );
  return {
    floor: found.arena.entry.row * TILE,
    layout: () => chunksLayout(found.recipe.theme, [id, ...fillers], library),
    name: `${id} ${found.recipe.theme}`,
  };
}

// Give-up, return and rearm: Chibi engages a boss on one side of the nook, is placed at col 140
// (beyond the escape distance) so the boss gives up where it is, and is then placed past the
// nook's step, within every ground boss's jump.
// Chibi's placement past the step.
const REARM_STAND_TICK = 900;
// The bound after Chibi's placement past the step: up to two seconds for the next rearm probe
// (awareness returning, or a body width of patrol after an exhausted search), then the four
// seconds the idle recovery rule allows an engaged boss without horizontal progress.
const REARM_SECONDS = 6;

interface RearmPlacement {
  // Chibi's first column and feet row (the arena floor by default), and the tick he leaves.
  readonly first: { readonly col: number; readonly row?: number };
  readonly leave?: number;
  readonly stand: number;
}

// Places Chibi's feet at each column from its tick on, standing still otherwise. Each run ends
// when the rearm bound does.
function rearmPlaced(
  boss: Boss,
  seed: number,
  { first, leave = 2, stand }: RearmPlacement,
): BossScenario {
  const { floor, layout, name } = sample(boss);
  return {
    controller: () => () => STILL,
    layout,
    name: `rearm ${name} ${first.col}/140/${stand} leaving at ${leave} seed ${seed}`,
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

// Wander: Chibi stands two chunks past the sample arena from the start, beyond the boss's
// awareness, for twice the wander bound.
const WANDER_SECONDS = 10;
function unengaged(boss: Boss): BossScenario {
  const { floor, layout, name } = sample(boss);
  return {
    controller: () => () => STILL,
    layout,
    name: `wander ${name} seed 1`,
    place: (tick) => (tick === 0 ? { x: 140 * TILE, y: floor } : undefined),
    seed: 1,
    ticks: Math.round(WANDER_SECONDS / STEP_SECONDS),
  };
}

const rearmChecks = (edgeCol: number) => (): readonly Property<BossTick>[] => [
  crossesAfterSettle(edgeCol * TILE, REARM_SECONDS, REARM_STAND_TICK),
];

// Apartment building: after each parcel throw Fert stands still for 1 s inside the committed
// throw, and the attack cooldown begins after the pause.
const FERT_THROW_PAUSE_SECONDS = 1;
const fertChecks = (): readonly Property<BossTick>[] => [
  committedHold(
    "ferret-antagonist",
    "throw-rest",
    FERT_THROW_PAUSE_SECONDS,
    CHARACTERS["ferret-antagonist"]!.behaviour!.attackCooldownSeconds!,
  ),
];

// A perch eight rows above the sample arena's right deck, out of reach of any boss's jump. A
// synthetic placement.
const PERCH = { col: 43, cols: 4, rise: 14 } as const;
function perched(boss: Boss, label: string): BossScenario {
  const row = sampleArenaCase(SAMPLE_BOSSES[boss]).arena.entry.row - PERCH.rise;
  const { layout, name } = sample(boss, [
    { character: "platform-ledge", col: PERCH.col, cols: PERCH.cols, role: "ledge", row },
  ]);
  return {
    controller: () => () => STILL,
    layout,
    name: `${label} perch ${name} seed 1`,
    place: (tick) => (tick === 0 ? { x: (PERCH.col + 1) * TILE, y: row * TILE } : undefined),
    seed: 1,
    ticks: ENCOUNTER_TICKS,
  };
}

// Fert throws: Chibi stands on the perch, inside Fert's throw engagement range, so map pursuit
// paces below him without contact and Fert tells and throws.
const FERT_THROW = perched("Fert", "fert throw");

// Pacing out of reach: Chibi stands on the perch, out of reach of any of Archie's jumps or his
// pounce, so Archie walks to the reachable spot nearest him and paces there.
const PACE_PERCH = perched("Archie", "pace");
// One decision (at most 0.9 s) plus the walk there, and the pace's 2 tiles each side beside
// Archie's half width and the spot's offset from Chibi.
const PACE_SECONDS = 3;
const PACE_TILES = 6;

// Kiwi encounter: a re-told second charge has at least 3 tiles of ground ahead, so it moves.
const KIWI_SECOND_CHARGE_TILES = 3;
const kiwiChecks = (): readonly Property<BossTick>[] => [
  movesAtLeast("raccoon-antagonist", "rush-second", KIWI_SECOND_CHARGE_TILES * TILE),
];

// Chibi stands still on the pier of Archie's arena, three tiles wide and narrower than Archie's
// body, beside the overpass deck that meets its top: the movement map's node over deck and pier
// top is his, so Archie climbs to it.
const PIER = { col: 43, row: 74 } as const;
const BLOCK_TOP: BossScenario = {
  controller: () => () => STILL,
  layout: () => chunkLayout(ARENAS.Archie.theme, ARENAS.Archie.id),
  name: `block top ${ARENAS.Archie.id} ${ARENAS.Archie.theme} ${PIER.col}/${PIER.row} seed 1`,
  place: (tick) => (tick === 0 ? { x: PIER.col * TILE, y: PIER.row * TILE } : undefined),
  seed: 1,
  ticks: Math.round(4 / STEP_SECONDS),
};

// Chibi stands at the sample arena's entry, beyond the nook's low step, which Archie must route
// over instead of holding against it.
const LOW_STEP_STILL: BossScenario = {
  controller: scripted("still"),
  layout: sample("Archie").layout,
  name: `still ${sample("Archie").name} seed 1`,
  seed: 1,
  ticks: ENCOUNTER_TICKS,
};

// Chibi paces at the sample arena's entry and dies, so the boss chases again after a retry.
const LOW_STEP_RETRY: BossScenario = {
  ...LOW_STEP_STILL,
  controller: scripted("pace"),
  name: `pace ${sample("Archie").name} seed 1`,
};

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
  ...(Object.keys(ARENAS) as Boss[]).map((boss): BossScenarioGroup => ({
    boss,
    checks: () => [leavesSpawn()],
    covers: [],
    scenario: unengaged(boss),
    subject: `wander: unengaged, ${boss} leaves the spawn and keeps moving`,
  })),
  {
    boss: "Trixi",
    covers: ["tell", "attack"],
    scenario: arenaEncounter("Trixi", "still"),
    subject: "Trixi arena: standing at the entry",
  },
  {
    boss: "Trixi",
    covers: ["tell", "attack"],
    scenario: arenaEncounter("Trixi", "pace"),
    subject: "Trixi arena: pacing at the entry",
  },
  {
    boss: "Trixi",
    checks: () => [movesWhileEngaged(2, TILE / 2)],
    covers: ["tell", "attack"],
    scenario: botEncounter(ARENAS.Trixi.theme, [ARENAS.Trixi.id], 5),
    subject: "Trixi arena: the reactive bot crossing past Trixi, who keeps moving while engaged",
  },
  {
    boss: "Fert",
    covers: ["tell", "attack"],
    scenario: arenaEncounter("Fert", "still"),
    subject: "Fert arena: standing at the entry",
  },
  {
    boss: "Fert",
    checks: fertChecks,
    covers: ["tell", "attack"],
    scenario: arenaEncounter("Fert", "forward"),
    subject: "Fert arena: crossing forward",
  },
  {
    boss: "Fert",
    checks: fertChecks,
    covers: ["tell", "attack"],
    scenario: FERT_THROW,
    subject: "Fert throw: map pursuit paces below an unreachable perch, so Fert throws and rests",
  },
  {
    boss: "Pebble",
    covers: ["tell", "attack"],
    scenario: arenaEncounter("Pebble", "still"),
    subject: "Pebble overhead crossing to a tell and an attack",
  },
  {
    boss: "Pebble",
    covers: [],
    scenario: arenaEncounter("Pebble", "pace"),
    subject: "Pebble overhead crossing while Chibi paces",
  },
  {
    boss: "Pebble",
    covers: [],
    scenario: arenaEncounter("Pebble", "forward"),
    subject: "Pebble overhead crossing while Chibi runs forward",
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
    scenario: arenaEncounter("Archie", "pace"),
    subject: "Archie arena: pacing at the entry",
  },
  {
    boss: "Kiwi",
    covers: ["tell", "attack"],
    scenario: arenaEncounter("Kiwi", "still"),
    subject: "Kiwi arena: standing at the entry",
  },
  {
    boss: "Archie",
    // Objects: Attack sequencing: after a second consecutive cancelled tell, 1.5 s with no tell.
    checks: () => [tellPauseLasts(1.5)],
    covers: ["tell", "tell-pause"],
    scenario: TELL_CAP_ARCHIE,
    subject: "tell cap: two cancelled pounce tells start the no-tell pause",
  },
  {
    boss: "Kiwi",
    checks: kiwiChecks,
    covers: ["tell", "attack", "retell"],
    scenario: kiwiBehind(),
    subject: "Kiwi's second charge: re-aimed toward Chibi behind her, with room to rush",
  },
  {
    boss: "Bini",
    covers: ["tell", "attack"],
    scenario: arenaEncounter("Bini", "still"),
    subject: "Bini arena: standing at the entry",
  },
  {
    boss: "Archie",
    checks: () => [risesToRow(PIER.row * TILE, 3)],
    covers: [],
    scenario: BLOCK_TOP,
    subject: "goal selection: Archie climbs beside Chibi on a block top narrower than his body",
  },
  {
    boss: "Archie",
    checks: () => [movesWhileEngaged(2, TILE / 2)],
    covers: [],
    scenario: LOW_STEP_STILL,
    subject: "low step: Archie routes over the nook's step instead of holding against it",
  },
  {
    boss: "Archie",
    checks: () => [movesWhileEngaged(2, TILE / 2)],
    covers: [],
    scenario: LOW_STEP_RETRY,
    subject: "low step after a retry: Archie routes or paces instead of holding",
  },
  {
    boss: "Archie",
    checks: rearmChecks(NOOK.right),
    covers: [],
    scenario: rearmPlaced("Archie", 1, { first: { col: 14 }, stand: 46 }),
    subject: "rearm: Archie gives up left of the nook and rearms over its step to the right",
  },
  {
    boss: "Archie",
    checks: rearmChecks(NOOK.left),
    covers: [],
    scenario: rearmPlaced("Archie", 1, { first: { col: 46 }, stand: 14 }),
    subject: "rearm: Archie gives up right of the nook and rearms over its step to the left",
  },
  {
    boss: "Trixi",
    checks: rearmChecks(NOOK.right),
    covers: ["limited-move"],
    scenario: rearmPlaced("Trixi", 1, { first: { col: 14 }, leave: 120, stand: 46 }),
    subject:
      "rearm: Trixi gives up left of the nook and rearms over its step, sliding after a rush",
  },
  {
    boss: "Archie",
    checks: (layout) => [
      pacesNearest(layout, PACE_SECONDS, PACE_TILES * TILE),
      movesWhileEngaged(2, TILE / 2),
    ],
    covers: [],
    scenario: PACE_PERCH,
    subject:
      "pace: Archie paces slowly at the reachable spot nearest a Chibi out of reach, then gives up",
  },
  {
    boss: "Fert",
    checks: rearmChecks(NOOK.right),
    covers: [],
    scenario: rearmPlaced("Fert", 1, { first: { col: 14 }, stand: 46 }),
    subject: "rearm: Fert gives up left of the nook and rearms over its step to the right",
  },
  {
    boss: "Fert",
    covers: [],
    scenario: rearmPlaced("Fert", 1, { first: { col: 50, row: 44 }, leave: 230, stand: 14 }),
    subject:
      "give-up in the air: Fert gives up mid-climb onto the right deck and lands before patrolling",
  },
  {
    boss: "Bini",
    checks: rearmChecks(NOOK.right),
    covers: [],
    scenario: rearmPlaced("Bini", 1, { first: { col: 14 }, stand: 46 }),
    subject: "rearm: Bini gives up left of the nook and rearms over its step to the right",
  },
];
