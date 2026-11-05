import { EDGE, rectAt } from "../core";
import type { Instance, ObjectLayout, Orbit, Point, Rect, Size } from "../data/types";
import { axisOf, type Track } from "./motion";

export function validateOrbitReferences(
  instances: readonly Instance[],
): ReadonlyMap<string, number> {
  const ids = new Map<string, number>();
  instances.forEach((instance, index) => {
    if (instance.id !== undefined) {
      if (!instance.id.trim() || ids.has(instance.id)) {
        throw new Error(`Invalid or duplicate instance id ${instance.id}`);
      }
      ids.set(instance.id, index);
    }
  });
  const visiting = new Set<number>();
  const done = new Set<number>();
  const visit = (index: number) => {
    if (visiting.has(index)) {
      throw new Error("Cyclic orbit relationship");
    }
    if (done.has(index)) {
      return;
    }
    visiting.add(index);
    const orbit = instances[index]!.orbit;
    if (orbit) {
      if (
        !orbit.host.trim() ||
        !Number.isFinite(orbit.radius) ||
        orbit.radius <= 0 ||
        !Number.isFinite(orbit.angularSpeed) ||
        !Number.isFinite(orbit.phase)
      ) {
        throw new Error("Invalid orbit configuration");
      }
      const host = ids.get(orbit.host);
      if (host === undefined) {
        throw new Error(`Missing orbit host ${orbit.host}`);
      }
      if (host === index) {
        throw new Error("An orbit cannot reference itself");
      }
      visit(host);
    }
    visiting.delete(index);
    done.add(index);
  };
  instances.forEach((_, index) => visit(index));
  return ids;
}

// Prefixes instance ids and the orbit hosts and phase sources that name them, so placements that
// reuse an id keep their references inside their own scope.
export function prefixInstanceIds(prefix: string, instances: readonly Instance[]): Instance[] {
  return instances.map((instance) => ({
    ...instance,
    ...(instance.id !== undefined && { id: `${prefix}${instance.id}` }),
    ...(instance.orbit && {
      orbit: { ...instance.orbit, host: `${prefix}${instance.orbit.host}` },
    }),
    ...(instance.phaseSource !== undefined && {
      phaseSource: `${prefix}${instance.phaseSource}`,
    }),
  }));
}

// Scopes instance ids and the orbit hosts and phase sources that name them to one chunk.
export function namespaceOrbitInstances(
  scope: string,
  instances: readonly Instance[],
): readonly Instance[] {
  validateOrbitReferences(instances);
  return prefixInstanceIds(`${scope}/`, instances);
}

export function orbitPosition(
  seconds: number,
  host: Rect,
  orbit: Orbit<number>,
  child: Size,
): Point {
  const angle = orbit.phase + orbit.angularSpeed * seconds;
  return {
    x: host.x + host.width / 2 + orbit.radius * Math.cos(angle) - child.width / 2,
    y: host.y + host.height / 2 + orbit.radius * Math.sin(angle) - child.height / 2,
  };
}

export function resolveOrbits(
  tile: number,
  instances: readonly Instance[],
  objects: readonly ObjectLayout[],
): readonly ObjectLayout[] {
  const ids = validateOrbitReferences(instances);
  return objects.map((object, index) => {
    const authored = instances[index]!.orbit;
    if (!authored) {
      return object;
    }
    const hostIndex = ids.get(authored.host)!;
    const host = objects[hostIndex]!;
    if (
      !["solid", "ledge"].includes(host.collision) ||
      host.behaviour ||
      host.reaction.kind !== "none" ||
      host.orbit ||
      instances[hostIndex]!.orbit ||
      host.motion.algorithm !== "linear" ||
      host.motion.variance !== 0 ||
      host.motion.distance <= 0 ||
      host.motion.speed <= 0 ||
      ![host.motion.distance, host.motion.speed, host.motion.pause, host.phase].every(
        Number.isFinite,
      ) ||
      host.motion.pause < 0
    ) {
      throw new Error(`Unsupported orbit host ${authored.host}`);
    }
    if (
      object.collision !== "hazard" ||
      object.behaviour ||
      object.contact ||
      object.motion.algorithm !== "static" ||
      object.reaction.kind !== "none" ||
      object.phase !== 0
    ) {
      throw new Error("Orbit requires an inert non-silhouette hazard");
    }
    const orbit = { ...authored, host: hostIndex, radius: authored.radius * tile };
    const expected = orbitPosition(0, rectAt(host, host.origin), orbit, object);
    if (
      Math.abs(expected.x - object.origin.x) > EDGE ||
      Math.abs(expected.y - object.origin.y) > EDGE
    ) {
      throw new Error("Orbit reference pose does not match authored col/row");
    }
    return { ...object, orbit };
  });
}

export function orbitBounds(objects: readonly ObjectLayout[], object: ObjectLayout): Rect {
  const orbit = object.orbit!;
  const host = objects[orbit.host]!;
  const axis = axisOf(host.motion.direction);
  const x = host.origin.x + host.width / 2;
  const y = host.origin.y + host.height / 2;
  return {
    height: Math.abs(axis.y * host.motion.distance) + 2 * orbit.radius + object.height,
    width: Math.abs(axis.x * host.motion.distance) + 2 * orbit.radius + object.width,
    x: x + Math.min(0, axis.x * host.motion.distance) - orbit.radius - object.width / 2,
    y: y + Math.min(0, axis.y * host.motion.distance) - orbit.radius - object.height / 2,
  };
}

export interface OrbitLeg {
  readonly start: number;
  readonly end: number;
  readonly from: Point;
  readonly to: Point;
}
export function orbitHostLegs(
  start: number,
  end: number,
  host: ObjectLayout,
  track: Track,
  before: Point,
  after: Point,
): readonly OrbitLeg[] {
  const travel = host.motion.distance / host.motion.speed;
  const half = travel + host.motion.pause;
  const period = 2 * half;
  const offset = host.phase * period;
  const times = [start, end];
  for (
    let cycle = Math.floor((offset + start) / period);
    cycle <= Math.floor((offset + end) / period);
    cycle++
  ) {
    for (const phase of [0, travel, half, half + travel]) {
      const time = cycle * period + phase - offset;
      if (time > start && time < end) {
        times.push(time);
      }
    }
  }
  times.sort((a, b) => a - b);
  const at = (time: number): Point => {
    if (time === start) {
      return before;
    }
    if (time === end) {
      return after;
    }
    const relative = track.at(time);
    return { x: host.origin.x + relative.x, y: host.origin.y + relative.y };
  };
  const unique = [...new Set(times)];
  return unique.slice(1).map((time, index) => ({
    end: time,
    from: at(unique[index]!),
    start: unique[index]!,
    to: at(time),
  }));
}

// Relative arc coordinates are linear host/bird travel plus one sine or cosine.
// Partition at derivative zeros and boundary roots, then test open overlap intervals.
export function orbitSweptContact(
  object: ObjectLayout,
  host: ObjectLayout,
  leg: OrbitLeg,
  bird: Rect,
  birdEnd: Rect,
): boolean {
  const orbit = object.orbit!;
  const duration = leg.end - leg.start;
  if (duration <= 0) {
    return false;
  }
  const box = object.hitbox ?? { height: object.height, width: object.width, x: 0, y: 0 };
  const theta = orbit.phase + orbit.angularSpeed * leg.start;
  const omega = orbit.angularSpeed;
  const period = 2 * Math.PI;
  const times = new Set([0, duration]);
  const coordinate = (axis: "x" | "y") => {
    const size = axis === "x" ? "width" : "height";
    const a = leg.from[axis] + host[size] / 2 - object[size] / 2 + box[axis] - bird[axis];
    const b = (leg.to[axis] - leg.from[axis] - birdEnd[axis] + bird[axis]) / duration;
    const value = (t: number) =>
      a +
      b * t +
      orbit.radius * (axis === "x" ? Math.cos(theta + omega * t) : Math.sin(theta + omega * t));
    const points = new Set([0, duration]);
    if (omega !== 0) {
      const ratio = (axis === "x" ? b : -b) / (orbit.radius * omega);
      if (Math.abs(ratio) <= 1) {
        const root = axis === "x" ? Math.asin(ratio) : Math.acos(ratio);
        for (const base of axis === "x" ? [root, Math.PI - root] : [root, -root]) {
          const low = Math.min(theta, theta + omega * duration);
          const high = Math.max(theta, theta + omega * duration);
          for (
            let turn = Math.ceil((low - base) / period);
            turn <= Math.floor((high - base) / period);
            turn++
          ) {
            const time = (base + turn * period - theta) / omega;
            if (time > 0 && time < duration) {
              points.add(time);
            }
          }
        }
      }
    }
    const sorted = [...points].sort((a, b) => a - b);
    for (const point of sorted) {
      times.add(point);
    }
    for (const limit of [-box[size], bird[size]]) {
      for (let index = 1; index < sorted.length; index++) {
        let low = sorted[index - 1]!;
        let high = sorted[index]!;
        const from = value(low);
        const to = value(high);
        if (from === limit) {
          times.add(low);
        }
        if (to === limit) {
          times.add(high);
        }
        if (from < limit === to < limit || from === limit || to === limit) {
          continue;
        }
        while (true) {
          const middle = low + (high - low) / 2;
          if (middle === low || middle === high || value(middle) === limit) {
            times.add(middle);
            break;
          }
          if (from < limit === value(middle) < limit) {
            low = middle;
          } else {
            high = middle;
          }
        }
      }
    }
    return (t: number) => value(t) > -box[size] && value(t) < bird[size];
  };
  const x = coordinate("x");
  const y = coordinate("y");
  const sorted = [...times].sort((a, b) => a - b);
  return sorted.some((time, index) => {
    const middle = index === 0 ? time : sorted[index - 1]! + (time - sorted[index - 1]!) / 2;
    return (x(time) && y(time)) || (x(middle) && y(middle));
  });
}
