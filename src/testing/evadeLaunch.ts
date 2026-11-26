import type { MapEdge } from "@andornaut/game-kit/runtime/terrain/movementMap";

import { EDGE } from "../core/index.ts";
import type { BirdTuning, Point } from "../data/types/index.ts";
import { ordinaryHorizontalVelocity } from "../rules/bird/index.ts";
import type { MapSupport } from "../rules/boss/index.ts";
import type { ZoneInput } from "../rules/zone/index.ts";

export type LaunchMove = -1 | 0 | 1;
type LaunchState = { readonly vx: number; readonly x: number };
export type LaunchSafety = (from: number, to: number, move: LaunchMove) => boolean;
interface LaunchPlan {
  readonly commands: readonly LaunchMove[];
  readonly states: readonly LaunchState[];
}
interface LaunchSearchWork {
  readonly expansions: number;
  readonly states: number;
  readonly transitions: number;
}
type LaunchPreparation =
  | { readonly kind: "ready" }
  | {
      readonly input: ZoneInput;
      readonly kind: "prepare";
      readonly plan: LaunchPlan;
      readonly search?: LaunchSearchWork;
    }
  | {
      readonly kind: "unknown";
      readonly search?: LaunchSearchWork;
    };

// A map witness applies its horizontal command immediately. Prepare that velocity with ordinary
// ground inputs, proving the run-up stays on this support before starting the jump clock.
export function prepareLaunch(
  safeStep: LaunchSafety,
  tuning: BirdTuning,
  seconds: number,
  span: { readonly left: number; readonly right: number },
  launch: { readonly left: number; readonly right: number },
  move: -1 | 0 | 1,
  bird: { readonly vx: number; readonly x: number },
): LaunchPreparation {
  if (
    ![seconds, tuning.walkSpeed, tuning.groundAccel, tuning.brakeAccel].every(
      (value) => Number.isFinite(value) && value > 0,
    ) ||
    ![bird.x, bird.vx, span.left, span.right, launch.left, launch.right].every(Number.isFinite) ||
    span.left > span.right ||
    launch.left > launch.right ||
    bird.x < span.left - EDGE ||
    bird.x > span.right + EDGE
  ) {
    return { kind: "unknown" };
  }
  const acceleration = Math.min(tuning.groundAccel, tuning.brakeAccel);
  const limit =
    Math.ceil((2 * tuning.walkSpeed) / (acceleration * seconds)) +
    Math.ceil((span.right - span.left) / (tuning.walkSpeed * seconds)) +
    2;
  const horizon = 3 * limit;
  const budget = horizon * (Math.ceil((2 * tuning.walkSpeed) / (acceleration * seconds)) + 1);
  const transitionLimit = 3 * budget;
  const stepDistance = Math.max(tuning.walkSpeed, Math.abs(bird.vx)) * seconds;
  const velocityStep = Math.max(tuning.groundAccel, tuning.brakeAccel) * seconds;
  if (
    ![limit, horizon, budget, transitionLimit].every(
      (value) => Number.isSafeInteger(value) && value > 0,
    ) ||
    ![stepDistance, velocityStep].every((value) => Number.isFinite(value) && value > 0)
  ) {
    return { kind: "unknown" };
  }
  if (!safeStep(bird.x, bird.x, 0)) {
    return { kind: "unknown" };
  }
  const speed = move * tuning.walkSpeed;
  const ready = ({ vx, x }: typeof bird) =>
    Math.abs(vx - speed) <= EDGE &&
    x >= launch.left - EDGE &&
    x <= launch.right + EDGE &&
    safeStep(x, x, move);
  if (ready(bird)) {
    return { kind: "ready" };
  }
  const search = { expansions: 0, states: 0, transitions: 0 };
  let exhausted = false;
  const unknown = () => ({ kind: "unknown", search: { ...search } }) as const;
  const advance = (state: typeof bird, command: -1 | 0 | 1) => {
    if (search.transitions === transitionLimit) {
      exhausted = true;
      return undefined;
    }
    search.transitions++;
    const vx = ordinaryHorizontalVelocity(tuning, seconds, command, true, state.vx);
    const x = state.x + vx * seconds;
    return x < span.left - EDGE || x > span.right + EDGE || !safeStep(state.x, x, command)
      ? undefined
      : { vx, x };
  };
  const forward = (initial: typeof bird, commands: (-1 | 0 | 1)[]) => {
    let state = initial;
    for (let tick = 0; tick < limit; tick++) {
      const next = advance(state, move);
      if (!next) {
        return undefined;
      }
      state = next;
      commands.push(move);
      if (ready(state)) {
        return commands;
      }
      if (state.vx === 0 && move === 0) {
        break;
      }
    }
    return undefined;
  };
  // Preserve feasible forward preparation; otherwise choose the shortest safe grounded prefix.
  let best = forward(bird, []);
  if (!best && move !== 0) {
    const opposite = move === 1 ? -1 : 1;
    let back = bird;
    const prefix: (-1 | 0 | 1)[] = [];
    for (let ticks = 0; ticks < limit; ticks++) {
      for (const brake of [false, true]) {
        let state = back;
        const commands = [...prefix];
        if (brake) {
          while (state.vx !== 0 && commands.length < 2 * limit) {
            const next = advance(state, 0);
            if (!next) {
              break;
            }
            state = next;
            commands.push(0);
          }
          if (state.vx !== 0) {
            continue;
          }
        }
        const candidate = forward(state, commands);
        if (candidate && (!best || candidate.length < best.length)) {
          best = candidate;
        }
      }
      const next = advance(back, opposite);
      if (!next) {
        break;
      }
      back = next;
      prefix.push(opposite);
    }
  }
  if (exhausted) {
    return unknown();
  }
  if (!best) {
    const toward = bird.x < launch.left ? 1 : bird.x > launch.right ? -1 : 0;
    const moves: readonly LaunchMove[] =
      move === 0
        ? toward === 0
          ? [0, -1, 1]
          : [toward, 0, toward === 1 ? -1 : 1]
        : [move, 0, move === 1 ? -1 : 1];
    const heuristic = (state: LaunchState) =>
      Math.max(
        Math.ceil(
          Math.max(0, launch.left - state.x - EDGE, state.x - launch.right - EDGE) / stepDistance,
        ),
        Math.ceil(Math.max(0, Math.abs(state.vx - speed) - EDGE) / velocityStep),
      );
    const records: {
      command: LaunchMove;
      depth: number;
      heap: number;
      lower: number;
      order: number;
      parent: number;
      state: LaunchState;
    }[] = [
      { command: 0, depth: 0, heap: -1, lower: heuristic(bird), order: 0, parent: -1, state: bird },
    ];
    const visited = new Map<number, Map<number, number>>([[bird.x, new Map([[bird.vx, 0]])]]);
    const heap: number[] = [];
    let order = 0;
    const earlier = (left: number, right: number) => {
      const a = records[left]!;
      const b = records[right]!;
      return (
        a.depth + a.lower < b.depth + b.lower ||
        (a.depth + a.lower === b.depth + b.lower && a.order < b.order)
      );
    };
    const swap = (left: number, right: number) => {
      [heap[left], heap[right]] = [heap[right]!, heap[left]!];
      records[heap[left]!]!.heap = left;
      records[heap[right]!]!.heap = right;
    };
    const enqueue = (index: number) => {
      const record = records[index]!;
      if (record.heap === -1) {
        record.heap = heap.length;
        record.order = order++;
        heap.push(index);
      }
      let at = record.heap;
      while (at > 0) {
        const parent = Math.floor((at - 1) / 2);
        if (!earlier(heap[at]!, heap[parent]!)) {
          break;
        }
        swap(at, parent);
        at = parent;
      }
    };
    const pop = () => {
      const index = heap[0]!;
      const last = heap.pop()!;
      records[index]!.heap = -1;
      if (heap.length > 0) {
        heap[0] = last;
        records[last]!.heap = 0;
        let at = 0;
        while (2 * at + 1 < heap.length) {
          let child = 2 * at + 1;
          if (child + 1 < heap.length && earlier(heap[child + 1]!, heap[child]!)) {
            child++;
          }
          if (!earlier(heap[child]!, heap[at]!)) {
            break;
          }
          swap(at, child);
          at = child;
        }
      }
      return index;
    };
    enqueue(0);
    search.states = 1;
    while (heap.length > 0) {
      if (search.expansions === budget) {
        return unknown();
      }
      const index = pop();
      const record = records[index]!;
      search.expansions++;
      if (ready(record.state)) {
        best = [];
        for (let at = index; records[at]!.parent !== -1; at = records[at]!.parent) {
          best.push(records[at]!.command);
        }
        best.reverse();
        break;
      }
      if (record.depth === horizon) {
        continue;
      }
      for (const command of moves) {
        if (command === 0 && record.state.vx === 0) {
          continue;
        }
        const next = advance(record.state, command);
        if (exhausted) {
          return unknown();
        }
        if (!next) {
          continue;
        }
        const depth = record.depth + 1;
        const lower = heuristic(next);
        if (depth + lower > horizon) {
          continue;
        }
        const previous = visited.get(next.x)?.get(next.vx);
        if (previous !== undefined) {
          if (records[previous]!.depth <= depth) {
            continue;
          }
          Object.assign(records[previous]!, { command, depth, parent: index });
          enqueue(previous);
          continue;
        }
        if (records.length === budget) {
          return unknown();
        }
        const velocities = visited.get(next.x) ?? new Map<number, number>();
        velocities.set(next.vx, records.length);
        visited.set(next.x, velocities);
        records.push({ command, depth, heap: -1, lower, order: 0, parent: index, state: next });
        enqueue(records.length - 1);
        search.states = records.length;
      }
    }
    if (!best) {
      return unknown();
    }
  }
  const states: LaunchState[] = [bird];
  for (const command of best) {
    const next = advance(states.at(-1)!, command);
    if (!next) {
      return unknown();
    }
    states.push(next);
  }
  return {
    input: { jumpHeld: false, move: best[0]!, useHeld: false },
    kind: "prepare",
    plan: { commands: best, states },
    search: { ...search },
  };
}

type LaunchEdge = Pick<MapEdge<MapSupport>, "commands" | "kind" | "launch">;
interface LaunchContext {
  readonly bird: { readonly vx: number; readonly x: number };
  readonly edge?: LaunchEdge | undefined;
  readonly grounded: boolean;
  readonly goal?: Point | undefined;
  readonly hasGoal: boolean;
  readonly scripted: boolean;
  readonly span?: { readonly left: number; readonly right: number } | undefined;
}

// One step backing up along the support, away from a jump launch no preparation reaches, for a
// longer run-up: none when the launch takes no heading or the step leaves the support or is unsafe.
export function runUpStep(
  safeStep: LaunchSafety,
  tuning: BirdTuning,
  seconds: number,
  span: { readonly left: number; readonly right: number },
  edge: LaunchEdge,
  bird: { readonly vx: number; readonly x: number },
): ZoneInput | undefined {
  const back = -edge.commands[0]!.move as LaunchMove;
  const to = bird.x + ordinaryHorizontalVelocity(tuning, seconds, back, true, bird.vx) * seconds;
  return back !== 0 &&
    to >= span.left - EDGE &&
    to <= span.right + EDGE &&
    safeStep(bird.x, to, back)
    ? { jumpHeld: false, move: back, useHeld: false }
    : undefined;
}

export function startsJump(edge: LaunchEdge | undefined) {
  return Boolean(edge?.commands[0]?.jump);
}

export function createLaunchPreparation(tuning: BirdTuning, seconds: number) {
  let pending:
    | {
        cursor: number;
        edge: LaunchEdge;
        goal?: Point | undefined;
        plan: LaunchPlan;
        span: { readonly left: number; readonly right: number };
      }
    | undefined;
  const step = (safeStep: LaunchSafety, context: LaunchContext) => {
    const { bird, edge, goal, grounded, hasGoal, scripted, span } = context;
    if (!grounded || !hasGoal || scripted || !span || !edge || !startsJump(edge)) {
      pending = undefined;
      return { kind: "approach" } as const;
    }
    if (
      pending &&
      (pending.edge !== edge ||
        pending.span.left !== span.left ||
        pending.span.right !== span.right ||
        pending.goal?.x !== goal?.x ||
        pending.goal?.y !== goal?.y)
    ) {
      pending = undefined;
    }
    if (pending) {
      const expected = pending.plan.states[pending.cursor]!;
      const safe =
        expected.x === bird.x &&
        expected.vx === bird.vx &&
        pending.plan.commands.slice(pending.cursor).every((command, index) => {
          const from = pending!.plan.states[pending!.cursor + index]!;
          const to = pending!.plan.states[pending!.cursor + index + 1]!;
          return safeStep(from.x, to.x, command);
        }) &&
        safeStep(
          pending.plan.states.at(-1)!.x,
          pending.plan.states.at(-1)!.x,
          edge.commands[0]!.move,
        );
      if (safe && pending.cursor < pending.plan.commands.length) {
        const command = pending.plan.commands[pending.cursor++]!;
        return {
          input: { jumpHeld: false, move: command, useHeld: false },
          kind: "prepare",
        } as const;
      }
      pending = undefined;
    }
    const preparation = prepareLaunch(
      safeStep,
      tuning,
      seconds,
      span,
      edge.launch,
      edge.commands[0]!.move,
      bird,
    );
    if (preparation.kind === "prepare") {
      pending = {
        cursor: 1,
        edge,
        goal,
        plan: preparation.plan,
        span: { left: span.left, right: span.right },
      };
    }
    return preparation;
  };
  return Object.assign(step, {
    reset: () => {
      pending = undefined;
    },
  });
}
