import { EDGE, rectAt } from "../core";
import type {
  CircleOrbit,
  Instance,
  ObjectLayout,
  Orbit,
  PendulumOrbit,
  Point,
  Rect,
  Size,
} from "../data/types";
import { axisOf, type Track } from "./motion";

// Whether an orbit's own fields are well formed for its kind: a circle's radius, speed, phase and
// any stops; a pendulum's length, amplitude short of a quarter turn so the child stays below its
// pivot, a nonzero speed, its pause and a phase within one cycle.
function orbitFieldsValid(orbit: Orbit): boolean {
  switch (orbit.kind) {
    case "circle": {
      const stops = orbit.stops;
      return (
        Number.isFinite(orbit.radius) &&
        orbit.radius > 0 &&
        Number.isFinite(orbit.angularSpeed) &&
        Number.isFinite(orbit.phase) &&
        (stops === undefined ||
          (Number.isInteger(stops.count) &&
            stops.count >= 1 &&
            Number.isFinite(stops.seconds) &&
            stops.seconds > 0 &&
            orbit.angularSpeed !== 0))
      );
    }
    case "pendulum":
      return (
        Number.isFinite(orbit.length) &&
        orbit.length > 0 &&
        Number.isFinite(orbit.amplitude) &&
        orbit.amplitude > 0 &&
        orbit.amplitude < Math.PI / 2 &&
        Number.isFinite(orbit.angularSpeed) &&
        orbit.angularSpeed !== 0 &&
        Number.isFinite(orbit.pause) &&
        orbit.pause >= 0 &&
        Number.isFinite(orbit.phase) &&
        orbit.phase >= 0 &&
        orbit.phase < 1
      );
    default:
      return false;
  }
}

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
      if (!orbit.host.trim() || !orbitFieldsValid(orbit)) {
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

// The orbit's angle seconds after area entry. With stops it holds still for each stop's seconds,
// then turns at angularSpeed to the next stop, a 1 / count turn on.
export function orbitAngle(seconds: number, orbit: CircleOrbit<number>): number {
  const stops = orbit.stops;
  if (!stops) {
    return orbit.phase + orbit.angularSpeed * seconds;
  }
  const step = (2 * Math.PI) / stops.count;
  const travel = step / Math.abs(orbit.angularSpeed);
  const span = stops.seconds + travel;
  const done = Math.floor(seconds / span);
  const turning = Math.max(0, seconds - done * span - stops.seconds);
  return orbit.phase + Math.sign(orbit.angularSpeed) * step * done + orbit.angularSpeed * turning;
}

// A pendulum's whole cycle in seconds: a hold and a swing at each end.
export function pendulumCycleSeconds(orbit: PendulumOrbit<unknown>): number {
  return 2 * (orbit.pause + (2 * orbit.amplitude) / Math.abs(orbit.angularSpeed));
}

// A pendulum's angle from straight below seconds after area entry: holding for its pause at the
// end its speed starts from, swinging to the other end at angularSpeed, holding there, and
// swinging back, phase of a cycle in.
export function pendulumAngle(seconds: number, orbit: PendulumOrbit<unknown>): number {
  const cycle = pendulumCycleSeconds(orbit);
  const half = cycle / 2;
  const at = (((seconds + orbit.phase * cycle) % cycle) + cycle) % cycle;
  const back = at >= half;
  const start = (back ? 1 : -1) * Math.sign(orbit.angularSpeed) * orbit.amplitude;
  const swung = Math.max(0, at - (back ? half : 0) - orbit.pause) * Math.abs(orbit.angularSpeed);
  return start - Math.sign(start) * Math.min(2 * orbit.amplitude, swung);
}

// The child's top-left corner seconds after area entry on its path about the host's centre: on
// its circle or below its pendulum's pivot.
export function orbitPosition(
  seconds: number,
  host: Rect,
  orbit: Orbit<number>,
  child: Size,
): Point {
  let along: Point;
  switch (orbit.kind) {
    case "circle": {
      const angle = orbitAngle(seconds, orbit);
      along = { x: orbit.radius * Math.cos(angle), y: orbit.radius * Math.sin(angle) };
      break;
    }
    case "pendulum": {
      const angle = pendulumAngle(seconds, orbit);
      along = { x: orbit.length * Math.sin(angle), y: orbit.length * Math.cos(angle) };
      break;
    }
  }
  return {
    x: host.x + host.width / 2 + along.x - child.width / 2,
    y: host.y + host.height / 2 + along.y - child.height / 2,
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
    if (object.collision !== "ledge" && authored.kind === "pendulum") {
      throw new Error("A pendulum orbit requires a ledge");
    }
    if (object.collision !== "ledge" && authored.kind === "circle" && authored.stops) {
      throw new Error("Orbit stops require a ledge");
    }
    if (object.collision === "ledge") {
      validatePathLedge(instances[hostIndex]!, host, authored, object);
    } else if (
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
    } else if (
      object.collision !== "hazard" ||
      object.behaviour ||
      object.contact ||
      object.motion.algorithm !== "static" ||
      object.reaction.kind !== "none" ||
      object.phase !== 0
    ) {
      throw new Error("Orbit requires an inert non-silhouette hazard or ledge");
    }
    const orbit: Orbit<number> =
      authored.kind === "circle"
        ? { ...authored, host: hostIndex, radius: authored.radius * tile }
        : { ...authored, host: hostIndex, length: authored.length * tile };
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

// A ledge on a path about a host that never moves, whose centre is the path's pivot: the host has
// no motion, behaviour, reaction or orbit of its own, and the ledge is inert, so the path alone
// places it. The ledge translates only, staying level.
function validatePathLedge(
  hostInstance: Instance,
  host: ObjectLayout,
  orbit: Orbit,
  object: ObjectLayout,
): void {
  if (
    host.behaviour ||
    host.reaction.kind !== "none" ||
    host.orbit ||
    hostInstance.orbit ||
    host.motion.algorithm !== "static" ||
    host.phase !== 0
  ) {
    throw new Error(`Unsupported orbit host ${orbit.host}: a ledge orbits a static host`);
  }
  if (
    object.behaviour ||
    object.crumbling ||
    object.forcedTransit ||
    object.motion.algorithm !== "static" ||
    object.reaction.kind !== "none" ||
    object.phase !== 0
  ) {
    throw new Error("Orbit requires an inert non-silhouette hazard or ledge");
  }
}

// Whether an object is a ledge on a path about a static host.
export function pathLedge(object: ObjectLayout): boolean {
  return object.orbit !== undefined && object.collision === "ledge";
}

// The rect a child's path sweeps: its circle about its host's track, or its pendulum's arc below
// a static pivot, highest at both ends.
export function orbitBounds(objects: readonly ObjectLayout[], object: ObjectLayout): Rect {
  const orbit = object.orbit!;
  const host = objects[orbit.host]!;
  const x = host.origin.x + host.width / 2;
  const y = host.origin.y + host.height / 2;
  if (orbit.kind === "pendulum") {
    const half = orbit.length * Math.sin(orbit.amplitude);
    const top = y + orbit.length * Math.cos(orbit.amplitude) - object.height / 2;
    return {
      height: y + orbit.length + object.height / 2 - top,
      width: 2 * half + object.width,
      x: x - half - object.width / 2,
      y: top,
    };
  }
  const axis = axisOf(host.motion.direction);
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
  if (orbit.kind !== "circle") {
    throw new Error("Swept orbit contact requires a circle");
  }
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
