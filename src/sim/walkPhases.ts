interface HorizontalSpan {
  readonly left: number;
  readonly right: number;
}

export interface PhaseMover extends HorizontalSpan {
  readonly cycleSteps: number;
  readonly index: number;
}

// A merged landing surface contributes only the portion within the existing physics bound.
export function landingCorridor(
  width: number,
  reach: number,
  positions: readonly number[],
  target: HorizontalSpan,
): HorizontalSpan {
  const left = Math.min(...positions);
  const right = Math.max(...positions) + width;
  const landingLeft = Math.max(target.left, left - reach);
  const landingRight = Math.min(target.right, right + reach);
  return landingLeft <= landingRight
    ? { left: Math.min(left, landingLeft), right: Math.max(right, landingRight) }
    : { left, right };
}

export function phaseCount(
  waitStep: number,
  margin: number,
  required: readonly (number | undefined)[],
  movers: readonly PhaseMover[],
  corridor: HorizontalSpan,
): number {
  let longest = 0;
  for (const mover of movers) {
    if (
      required.includes(mover.index) ||
      (mover.left < corridor.right + margin && mover.right > corridor.left - margin)
    ) {
      longest = Math.max(longest, mover.cycleSteps);
    }
  }
  return Math.floor(longest / waitStep) + 1;
}

// Retain exact sampled state identities for the walk's prepared-trial cache. A terminal sample
// is permanent; requesting a larger local cycle never repeats an exhausted wait.
export function phaseStarts<State>(
  sample: (previous: State) => State | undefined,
  initial: State,
): (count: number) => readonly State[] {
  const states = [initial];
  let exhausted = false;
  return (count) => {
    while (!exhausted && states.length < count) {
      const next = sample(states[states.length - 1]!);
      if (next === undefined) {
        exhausted = true;
      } else {
        states.push(next);
      }
    }
    return states.slice(0, count);
  };
}
