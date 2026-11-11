import { expect, it } from "vitest";

import { EDGE, STEP_SECONDS } from "../core";
import { SCREEN } from "../data/screen";
import { chunkLayout, ENCOUNTER_SCRIPTS, ORDINARY } from "../testing/encounterLayouts";
import { scriptedChibi, simulateBosses } from "./bossSimulator";

// Pebble in his arena for a minute, with Chibi standing in the open at the entry, so every
// death restarts the same exposed encounter.
function freightTerminal() {
  return simulateBosses(ORDINARY, {
    controller: () => scriptedChibi(ENCOUNTER_SCRIPTS.still!),
    layout: () => chunkLayout("freight-terminal", "arena-pigeon-freight-terminal"),
    name: "freight terminal still",
    seed: 1,
    ticks: Math.round(60 / STEP_SECONDS),
  }).ticks;
}

it("gives Pebble a tell every 6 to 10 s of engagement, each committed", () => {
  let engaged = 0,
    tells = 0,
    commits = 0,
    previous: string | undefined;
  for (const { agents } of freightTerminal()) {
    const attack = agents[0]?.attack;
    const phase = attack && `${attack.id}:${attack.phase}`;
    engaged += agents[0]?.pursuit === "engaged" ? STEP_SECONDS : 0;
    if (attack && phase !== previous) {
      tells += attack.phase === "tell" ? 1 : 0;
      commits += attack.phase === "committed" ? 1 : 0;
    }
    previous = phase;
  }
  expect(engaged).toBeGreaterThan(50);
  expect(engaged / tells).toBeGreaterThanOrEqual(6 - EDGE);
  expect(engaged / tells).toBeLessThanOrEqual(10 + EDGE);
  expect(commits).toBe(tells);
});

// Relocation legs land on Chibi's screen, so off it Pebble only ever closes on him.
it("never carries Pebble farther from a still Chibi while he is off Chibi's screen", () => {
  let last: { episode: number; offset: number } | undefined;
  for (const { agents, episode, target } of freightTerminal()) {
    const agent = agents[0]!;
    const offset = Math.abs(agent.at.x + agent.width / 2 - target.at.x - target.width / 2);
    if (last?.episode === episode && offset > SCREEN.width / 2 - agent.width / 2) {
      expect(offset).toBeLessThanOrEqual(last.offset + EDGE);
    }
    last = { episode, offset };
  }
});
