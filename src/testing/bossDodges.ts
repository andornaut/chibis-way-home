import { tellStarts } from "../ai/agentProperties";
import type { AgentSample } from "../ai/agentTrace";
import { STEP_SECONDS } from "../core";
import type { BirdTuning, BossFairness, DodgeName, ZoneLayout } from "../data/types";
import type { ZoneInput, ZoneState } from "../rules/zone";
import { maximumTellSeconds } from "../sim/bossProperties";
import {
  areaExit,
  bossModel,
  bossSample,
  type BossScenario,
  bossStart,
} from "../sim/bossSimulator";
import { DODGES } from "./dodges";

// Dodge witnesses (attack fairness): at each tell start in a boss scenario the zone is forked
// and each of the attack's named dodges runs from the reaction delay; until then Chibi repeats
// his input from the tell's tick. A fork survives when Chibi is alive once the told attack has
// ended (its tell cancelled or its committed phase done) and the recovery bound has passed, or
// when he leaves the area first. The scenario's placements still apply in a fork.

export interface DodgeFork {
  readonly attack: string;
  readonly boss: string;
  readonly kind: string;
  // Each named dodge's death, or undefined when Chibi survived.
  readonly outcomes: Readonly<Partial<Record<DodgeName, string | undefined>>>;
  readonly tick: number;
}

// A fork whose attack has not ended after this long stops and counts Chibi alive.
const FORK_LIMIT_SECONDS = 6;

interface Fork {
  readonly boss: AgentSample;
  readonly fairness: BossFairness;
  readonly hold: ZoneInput;
  readonly place: BossScenario["place"];
  readonly start: ZoneState;
}

function runFork(
  tuning: BirdTuning,
  layout: ZoneLayout,
  { boss, fairness, hold, place, start }: Fork,
  dodge: DodgeName,
): string | undefined {
  const model = bossModel(tuning, layout, place);
  const delay = Math.round(fairness.reactionDelaySeconds / STEP_SECONDS);
  const recovery = Math.round(fairness.recoveryMaxSeconds / STEP_SECONDS);
  const [area, index] = boss.id.split(":");
  const plan = layout.areas[area!]!.objects[Number(index)]!.behaviour!;
  const attack = boss.attack!;
  // A tell past its deadline has cancelled into another tell of the same attack.
  const tellTicks = Math.round(maximumTellSeconds(plan, attack.id) / STEP_SECONDS);
  const script = DODGES[dodge]();
  let zone = start;
  let seen = boss;
  let told = 1;
  let ended: number | undefined;
  for (let tick = 1; tick <= Math.round(FORK_LIMIT_SECONDS / STEP_SECONDS); tick++) {
    if (areaExit(tuning, layout, zone)) {
      return undefined;
    }
    const input =
      tick <= delay
        ? hold
        : script({
            boss: seen,
            seconds: (tick - delay - 1) * STEP_SECONDS,
            target: bossSample(tuning, layout, tick, zone).target,
          });
    zone = model.step(STEP_SECONDS, input, zone);
    if (zone.death) {
      return `${zone.death.reason} ${(tick * STEP_SECONDS).toFixed(2)} s after the tell, ${seen.state}`;
    }
    const sample = bossSample(tuning, layout, tick, zone).agents.find(({ id }) => id === boss.id);
    if (!sample) {
      return undefined;
    }
    told = sample.attack?.phase === "tell" && !sample.attack.continues ? told + 1 : 0;
    if (
      ended === undefined &&
      (sample.attack?.id !== attack.id || tellStarts(seen, sample) || told > tellTicks + 1)
    ) {
      ended = tick;
    }
    seen = sample;
    if (ended !== undefined && tick - ended >= recovery) {
      return undefined;
    }
  }
  return undefined;
}

// Every tell start in the scenario's run, each with the outcomes of its attack's named dodges.
export function dodgeForks(
  tuning: BirdTuning,
  fairness: (kind: string) => BossFairness,
  scenario: BossScenario,
): DodgeFork[] {
  const layout = scenario.layout();
  const model = bossModel(tuning, layout, scenario.place);
  const controller = scenario.controller(tuning, layout);
  const forks: DodgeFork[] = [];
  let zone = bossStart(tuning, layout, scenario);
  let previous = new Map<string, AgentSample>();
  let episode = -1;
  for (let tick = 0; tick < scenario.ticks; tick++) {
    zone = model.begin(zone);
    if (model.finished(zone)) {
      break;
    }
    const hold = controller(tick, zone);
    const before = zone;
    zone = model.step(STEP_SECONDS, hold, before);
    const sample = model.sample(tick, before, zone);
    for (const boss of sample.agents) {
      const prior = sample.episode === episode ? previous.get(boss.id) : undefined;
      if (zone.death || !tellStarts(prior, boss)) {
        continue;
      }
      const bounds = fairness(boss.kind);
      const fork: Fork = {
        boss,
        fairness: bounds,
        hold,
        place: scenario.place && ((next) => scenario.place!(tick + 1 + next)),
        start: zone,
      };
      const outcomes = Object.fromEntries(
        (bounds.dodges[boss.attack!.id] ?? []).map((dodge) => [
          dodge,
          runFork(tuning, layout, fork, dodge),
        ]),
      );
      forks.push({ attack: boss.attack!.id, boss: boss.id, kind: boss.kind, outcomes, tick });
    }
    previous = new Map(sample.agents.map((agent) => [agent.id, agent]));
    episode = sample.episode;
  }
  return forks;
}
