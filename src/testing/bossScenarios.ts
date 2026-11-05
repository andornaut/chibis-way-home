import type { Property } from "../ai/agentProperties";
import { STEP_SECONDS } from "../core";
import { DOG_BEHAVIOUR } from "../data/behaviours";
import { CHARACTERS } from "../data/characters";
import { TILE } from "../data/screen";
import type { ObjectLayout, ZoneLayout } from "../data/types";
import { startBird } from "../rules/bird";
import type { ZoneInput } from "../rules/zone";
import {
  committedHold,
  crossesAfterSettle,
  movesAtLeast,
  movesWhileEngaged,
  risesToRow,
  tellPauseLasts,
} from "../sim/bossProperties";
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

const TELL_CAP_ARCHIE: BossScenario = {
  controller: (_, layout) => pounceDodger(layout),
  layout: () =>
    chunksLayout(
      "city-streets",
      DODGE_CHUNKS,
      withInstances("low-central-crossing", [
        {
          behaviour: { ...DOG_BEHAVIOUR, initial: "pursuit-pounce" },
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

// Kiwi's second charge: Chibi steps behind Kiwi during her first rush and back to the entry
// during the re-aimed tell, so she turns with her whole track ahead and rushes again. Placements
// stand Chibi on Kiwi's floor. A synthetic placement.
const KIWI_BEHIND = { back: 150, behind: 110, col: 22 } as const;

function kiwiBehind(): BossScenario {
  const base = encounter("vertical-stack-early", "city-outskirts", "still");
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

// Kiwi encounter: a re-told second charge has at least 3 tiles of ground ahead, so it moves.
const KIWI_SECOND_CHARGE_TILES = 3;
const kiwiChecks = (): readonly Property<BossTick>[] => [
  movesAtLeast("raccoon-antagonist", "rush-second", KIWI_SECOND_CHARGE_TILES * TILE),
];

// Chibi stands still on the late patrol yard's right block, four tiles wide and narrower than
// Archie's body, beside the ledge that meets its top: the movement map's node over ledge and
// block top is his, so Archie climbs to it.
const BLOCK_TOP: BossScenario = {
  controller: () => () => STILL,
  layout: () => chunksLayout("city-streets", ["patrol-cover-late", ...REARM_CHUNKS]),
  name: "block top patrol-cover-late city-streets 49/44 seed 1",
  place: (tick) => (tick === 0 ? { x: 49 * TILE, y: 44 * TILE } : undefined),
  seed: 1,
  ticks: Math.round(4 / STEP_SECONDS),
};

// Chibi stands at the early patrol yard's entry, beyond the low block Archie used to hold
// against without a route for more than four seconds.
const EARLY_YARD_STILL: BossScenario = {
  controller: scripted("still"),
  layout: () => chunksLayout("city-streets", ["patrol-cover-early", ...REARM_CHUNKS]),
  name: "still patrol-cover-early city-streets seed 1",
  seed: 1,
  ticks: ENCOUNTER_TICKS,
};

// Chibi paces at the early patrol yard's entry and dies, so the boss chases again after a retry.
const EARLY_YARD_RETRY: BossScenario = {
  ...EARLY_YARD_STILL,
  controller: scripted("pace"),
  name: "pace patrol-cover-early city-streets seed 1",
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
    checks: () => [movesWhileEngaged(2, TILE / 2)],
    covers: ["tell", "attack"],
    scenario: botEncounter("farmland", ["city-boundary-climb-yard"], 5),
    subject: "goose wall: the reactive bot climbing past Trixi, who routes up rather than hops",
  },
  {
    boss: "Fert",
    covers: ["tell", "attack"],
    scenario: encounter("apartment-tall-city-boundary-climb-yard", "apartment-lobby", "still"),
    subject: "Fert underpass",
  },
  {
    boss: "Fert",
    checks: fertChecks,
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
    covers: ["tell"],
    scenario: encounter("flyer-shelter-middle", "loading-yards", "forward"),
    subject: "Pebble middle shelter: attack cadence while Chibi runs forward",
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
    scenario: encounter("growl-cover-early", "deep-woods", "still"),
    subject: "Bini growl yard",
  },
  {
    boss: "Archie",
    checks: () => [risesToRow(44 * TILE, 3)],
    covers: [],
    scenario: BLOCK_TOP,
    subject: "goal selection: Archie climbs beside Chibi on a block top narrower than his body",
  },
  {
    boss: "Archie",
    checks: () => [movesWhileEngaged(2, TILE / 2)],
    covers: [],
    scenario: EARLY_YARD_STILL,
    subject: "early yard: Archie routes over the low block instead of holding against it",
  },
  {
    boss: "Archie",
    checks: () => [movesWhileEngaged(2, TILE / 2)],
    covers: [],
    scenario: EARLY_YARD_RETRY,
    subject: "early yard after a retry: Archie routes or paces instead of holding",
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
