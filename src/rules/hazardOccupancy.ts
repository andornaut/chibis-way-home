import { EDGE } from "../core";
import type { BehaviourNode, BirdTuning, ObjectLayout, Point, Rect } from "../data/types";
import type { BehaviourState } from "./behaviour";
import { axisOf } from "./motion";
import { orbitBounds } from "./orbit";
import { createTimedHazardSampler, timedHazardRect } from "./timedHazard";

const MAX_GRAPH_STATES = 128;

// Undefined means that this snapshot cannot certify future occupancy, not an empty envelope.
export function hazardBoundsAt(
  objects: readonly ObjectLayout[],
  state: BehaviourState | undefined,
  at: Point,
  contact: Rect,
  timeSeconds: number,
  object: ObjectLayout,
): (endSeconds: number) => Rect | undefined {
  const origin = { ...at };
  const occupied = { ...contact };
  const snapshot = state && {
    anchor: { ...(state.anchor ?? object.origin) },
    blocked: Boolean(
      state.hop ||
      state.traversal ||
      state.idleWatchdog?.recovery ||
      state.pursuit ||
      state.rearm ||
      state.landing,
    ),
    elapsed: state.elapsed,
    idleSeconds: state.idleWatchdog?.seconds ?? 0,
    stateKey: state.stateKey,
  };
  const results = new Map<number, Rect | undefined>();
  const calculate = (endSeconds: number): Rect | undefined => {
    const horizon = endSeconds - timeSeconds;
    if (
      ![timeSeconds, endSeconds, horizon, origin.x, origin.y].every(Number.isFinite) ||
      timeSeconds < 0 ||
      horizon < 0 ||
      object.reaction.kind !== "none"
    ) {
      return undefined;
    }
    // Native silhouette frame origins round to whole pixels at every future position.
    const rounding = object.contact ? 1 : 0;
    const paddingX =
      rounding +
      Math.max(0, origin.x - occupied.x, occupied.x + occupied.width - origin.x - object.width);
    const paddingY =
      rounding +
      Math.max(0, origin.y - occupied.y, occupied.y + occupied.height - origin.y - object.height);
    const padded = (range: number, rect: Rect): Rect | undefined => {
      const left = Math.min(rect.x, origin.x);
      const top = Math.min(rect.y, origin.y);
      const result = {
        height:
          Math.max(rect.y + rect.height, origin.y + object.height) - top + 2 * (paddingY + range),
        width:
          Math.max(rect.x + rect.width, origin.x + object.width) - left + 2 * (paddingX + range),
        x: left - paddingX - range,
        y: top - paddingY - range,
      };
      return Object.values(result).every(Number.isFinite) && result.width > 0 && result.height > 0
        ? result
        : undefined;
    };
    if (object.orbit) {
      const host = objects[object.orbit.host];
      if (
        !host ||
        host.behaviour ||
        host.orbit ||
        host.motion.variance !== 0 ||
        host.motion.algorithm !== "linear" ||
        host.reaction.kind !== "none" ||
        object.behaviour ||
        object.contact ||
        object.motion.algorithm !== "static"
      ) {
        return undefined;
      }
      return padded(0, orbitBounds(objects, object));
    }
    const plan = object.behaviour;
    if (!plan) {
      const motion = object.motion;
      if (motion.variance !== 0 || !["static", "linear", "ease"].includes(motion.algorithm)) {
        return undefined;
      }
      const axis = axisOf(motion.direction);
      const dx = motion.algorithm === "static" ? 0 : axis.x * motion.distance;
      const dy = motion.algorithm === "static" ? 0 : axis.y * motion.distance;
      return padded(0, {
        height: object.height + Math.abs(dy),
        width: object.width + Math.abs(dx),
        x: object.origin.x + Math.min(0, dx),
        y: object.origin.y + Math.min(0, dy),
      });
    }
    const actions = Object.values(plan.states).flatMap((node) => node.onEnter ?? []);
    const initial = plan.states[plan.initial];
    // Existing emitted effects are bounded only for a still-unacquired, stationary initial state.
    if (
      actions.length &&
      (!plan.pursuit ||
        !snapshot ||
        snapshot.stateKey !== plan.initial ||
        initial?.motion.kind !== "wait" ||
        initial.motion.wander ||
        initial.transitions.some(
          ({ when }) => !when.some(({ kind }) => kind === "visible" || kind === "pursuit-ended"),
        ) ||
        actions.some(({ kind }) => kind !== "force-pulse"))
    ) {
      return undefined;
    }
    if (
      !snapshot ||
      snapshot.blocked ||
      ![snapshot.elapsed, snapshot.idleSeconds, snapshot.anchor.x, snapshot.anchor.y].every(
        Number.isFinite,
      ) ||
      snapshot.elapsed < 0 ||
      snapshot.idleSeconds < 0 ||
      (plan.idleWatchdog &&
        (!Number.isFinite(plan.idleWatchdog.seconds) ||
          plan.idleWatchdog.seconds <= 0 ||
          horizon + snapshot.idleSeconds + EDGE >= plan.idleWatchdog.seconds)) ||
      (plan.pursuit &&
        Object.values(plan.states).some(
          ({ motion }) =>
            motion.kind === "fly" || (motion.kind === "pursue" && motion.mode === "fly"),
        ))
    ) {
      return undefined;
    }
    let left = origin.x,
      right = origin.x + object.width;
    let top = origin.y,
      bottom = origin.y + object.height;
    let range = 0;
    const actionRange = (node: BehaviourNode): number | undefined => {
      let result = 0;
      for (const action of node.onEnter ?? []) {
        if (
          !plan.pursuit ||
          action.kind !== "force-pulse" ||
          !Number.isFinite(action.range) ||
          !Number.isFinite(action.height) ||
          action.range < 0 ||
          action.height < 0
        ) {
          return undefined;
        }
        result = Math.max(result, action.range, action.height);
      }
      return result;
    };
    // Escaped ground pursuit cannot move before settling; reacquisition resets to initial first.
    const stationaryEscape = (start: string): number | undefined => {
      const pending = [start];
      const visited = new Set<string>();
      let radius = 0;
      while (pending.length) {
        const key = pending.pop()!;
        if (visited.has(key)) {
          continue;
        }
        visited.add(key);
        if (visited.size > MAX_GRAPH_STATES) {
          return undefined;
        }
        if (key === plan.initial) {
          continue;
        }
        const node = plan.states[key];
        if (
          !node ||
          (node.motion.kind === "wait" &&
            (node.motion.support === "required" || node.motion.wander)) ||
          (node.motion.kind !== "wait" &&
            !(node.motion.kind === "pursue" && node.motion.mode === "ground"))
        ) {
          return undefined;
        }
        const extra = actionRange(node);
        if (extra === undefined) {
          return undefined;
        }
        radius = Math.max(radius, extra);
        for (const transition of node.transitions) {
          // Visible means engaged for pursuit profiles, contradicting escaped/unsettled.
          if (transition.when.some(({ kind }) => kind === "visible")) {
            continue;
          }
          pending.push(transition.to);
          const guaranteed =
            transition.when.some(({ kind }) => kind === "pursuit-ended") &&
            transition.when.every(
              (condition) =>
                condition.kind === "pursuit-ended" ||
                (condition.kind === "elapsed" && condition.seconds === 0),
            );
          if (guaranteed && plan.states[transition.to]?.attack?.phase !== "tell") {
            break;
          }
        }
      }
      return radius;
    };
    const earliest = new Map([[snapshot.stateKey, 0]]);
    const queue = [snapshot.stateKey];
    // Escape settling can restore the initial state independently of authored graph edges.
    if (plan.pursuit && plan.initial !== snapshot.stateKey) {
      earliest.set(plan.initial, 0);
      queue.push(plan.initial);
    }
    const zeroEdges = new Map<string, string[]>();
    const processed = new Set<string>();
    while (queue.length) {
      const key = queue.shift()!;
      const entry = earliest.get(key)!;
      if (processed.has(key)) {
        continue;
      }
      processed.add(key);
      if (processed.size > MAX_GRAPH_STATES) {
        return undefined;
      }
      const node = plan.states[key];
      if (
        !node ||
        (node.motion.kind === "wait" &&
          (node.motion.support === "required" || node.motion.wander)) ||
        (node.motion.kind !== "wait" && (plan.pursuit || node.motion.kind !== "move"))
      ) {
        return undefined;
      }
      const extra = actionRange(node);
      if (extra === undefined) {
        return undefined;
      }
      range = Math.max(range, extra);
      if (node.motion.kind === "move") {
        const track = node.track ?? plan;
        const low = snapshot.anchor[track.axis] + Math.min(0, track.distance);
        const high = snapshot.anchor[track.axis] + Math.max(0, track.distance);
        if (track.axis === "x") {
          left = Math.min(left, low);
          right = Math.max(right, high + object.width);
        } else {
          top = Math.min(top, low);
          bottom = Math.max(bottom, high + object.height);
        }
      }
      const elapsed = key === snapshot.stateKey ? snapshot.elapsed : 0;
      for (const transition of node.transitions) {
        if (
          transition.when.some(
            (condition) =>
              condition.kind === "elapsed" &&
              (!Number.isFinite(condition.seconds) || condition.seconds < 0),
          )
        ) {
          return undefined;
        }
        const threshold = Math.max(
          0,
          ...transition.when.map((condition) =>
            condition.kind === "elapsed" ? condition.seconds : 0,
          ),
        );
        const next = entry + Math.max(0, threshold - elapsed);
        if (!Number.isFinite(next)) {
          return undefined;
        }
        if (next > horizon + EDGE) {
          continue;
        }
        if (plan.pursuit && transition.when.some(({ kind }) => kind === "pursuit-ended")) {
          const radius = stationaryEscape(transition.to);
          if (radius === undefined) {
            return undefined;
          }
          range = Math.max(range, radius);
          // The normal initial prefix is already explored from time zero, before any rearm.
          continue;
        }
        if (threshold === 0) {
          zeroEdges.set(key, [...(zeroEdges.get(key) ?? []), transition.to]);
        }
        if (!earliest.has(transition.to) || next < earliest.get(transition.to)!) {
          earliest.set(transition.to, next);
          queue.push(transition.to);
          queue.sort((a, b) => earliest.get(a)! - earliest.get(b)!);
        }
      }
    }
    const visiting = new Set<string>(),
      done = new Set<string>();
    const cyclic = (key: string): boolean => {
      if (visiting.has(key)) {
        return true;
      }
      if (done.has(key)) {
        return false;
      }
      visiting.add(key);
      if ((zeroEdges.get(key) ?? []).some(cyclic)) {
        return true;
      }
      visiting.delete(key);
      done.add(key);
      return false;
    };
    if ([...processed].some(cyclic)) {
      return undefined;
    }
    return padded(range, { height: bottom - top, width: right - left, x: left, y: top });
  };
  return (endSeconds) => {
    if (!results.has(endSeconds)) {
      results.set(endSeconds, calculate(endSeconds));
    }
    return results.get(endSeconds);
  };
}

// Preserve the legacy envelope while exposing certified timed contacts explicitly.
export function hazardOccupancy(
  tuning: BirdTuning,
  objects: readonly ObjectLayout[],
  state: BehaviourState | undefined,
  at: Point,
  contact: Rect,
  timeSeconds: number,
  object: ObjectLayout,
) {
  const timedContacts = createTimedHazardSampler(tuning, object, { at, state, timeSeconds });
  return {
    boundsAt: hazardBoundsAt(objects, state, at, contact, timeSeconds, object),
    rect: timedContacts ? timedHazardRect(object, at) : contact,
    ...(timedContacts && { timedContacts }),
  };
}
