import { type AgentSample, type AgentTick, centre } from "../ai/agentTrace";
import { STEP_SECONDS } from "../core";
import { TILE } from "../data/screen";
import type { DodgeName } from "../data/types";
import type { ZoneInput } from "../rules/zone";
import { ORDINARY } from "./encounterLayouts";

// Scripted dodges for the dodge-witness check (src/testing/bossDodges.ts). A script starts the
// reaction delay after a tell starts and reads only what Chibi sees: the told boss's body and
// attack phase, and his own body, from the last completed tick. Ordinary skills only: walking
// and full jumps, no Dash or double jump.

export interface DodgeView {
  readonly boss: AgentSample;
  // Seconds since the script started.
  readonly seconds: number;
  readonly target: AgentTick["target"];
}

export type DodgeScript = () => (view: DodgeView) => ZoneInput;

const STILL: ZoneInput = { jumpHeld: false, move: 0, useHeld: false };
const JUMP_SECONDS = ORDINARY.jumpRiseTime;

// Chibi's side of the boss: -1 when he is left of its centre.
const side = ({ boss, target }: DodgeView): -1 | 1 => (centre(target).x < centre(boss).x ? -1 : 1);

const horizontalGap = ({ boss, target }: DodgeView) =>
  Math.max(target.at.x - (boss.at.x + boss.width), boss.at.x - (target.at.x + target.width));

// A full jump toward the far side of the boss once it is within `trigger` pixels and has
// committed, or is `lead` seconds into the script during its tell, so he is high as a close rush
// arrives: the boss passes under him, or he clears it while it holds.
function jumpOver(trigger: number, lead: number): DodgeScript {
  return () => {
    let launched: { direction: -1 | 1; seconds: number } | undefined;
    return (view) => {
      if (!launched) {
        const phase = view.boss.attack?.phase;
        if (
          horizontalGap(view) > trigger ||
          (phase !== "committed" && !(phase === "tell" && view.seconds >= lead))
        ) {
          return STILL;
        }
        launched = { direction: side(view) === -1 ? 1 : -1, seconds: view.seconds };
      }
      const airborne = view.seconds - launched.seconds;
      if (airborne > STEP_SECONDS && view.target.grounded) {
        return STILL;
      }
      return { jumpHeld: airborne < JUMP_SECONDS, move: launched.direction, useHeld: false };
    };
  };
}

export const DODGES: Readonly<Record<DodgeName, DodgeScript>> = {
  // Jump over the boss within four tiles, from 0.45 s into its tell (0.15 s before a 0.6 s
  // charge tell commits) or as it commits.
  "jump-over": jumpOver(4 * TILE, 0.2),
  // Walk away from the boss for the whole attack, jumping whenever a step or wall stops him.
  retreat: () => {
    let jumped: number | undefined;
    return (view) => {
      const blocked =
        view.seconds > STEP_SECONDS && view.target.grounded && view.target.velocity.x === 0;
      if (blocked && (jumped === undefined || view.seconds - jumped > JUMP_SECONDS)) {
        jumped = view.seconds;
      }
      const jumpHeld = jumped !== undefined && view.seconds - jumped < JUMP_SECONDS;
      return { jumpHeld, move: side(view), useHeld: false };
    };
  },
  // Walk under the boss's arc or flight, toward and past its centre.
  under: () => {
    let direction: -1 | 1 | undefined;
    return (view) => {
      direction ??= side(view) === -1 ? 1 : -1;
      return { jumpHeld: false, move: direction, useHeld: false };
    };
  },
};
