import { sweptContact } from "../core";
import type { DeathContact, ObjectLayout, Point, Rect } from "../data/types";
import type { BehaviourEvent } from "./behaviour";

export interface Transient {
  readonly id: number;
  readonly emitter: number;
  readonly object: ObjectLayout;
  readonly at: Point;
  readonly velocity: Point;
  readonly gravity: number;
  readonly age: number;
  readonly lifeSeconds: number;
  readonly armSeconds: number;
  readonly armingAnimation?: string;
}

export interface SpawnEvent extends BehaviourEvent {
  readonly emitter: number;
  readonly emitterWidth: number;
  readonly template: ObjectLayout;
}

export function transientBox(entity: Transient, at: Point = entity.at): Rect {
  const box = entity.object.hitbox ?? {
    height: entity.object.height,
    width: entity.object.width,
    x: 0,
    y: 0,
  };
  return { ...box, x: at.x + box.x, y: at.y + box.y };
}

// The first positive interval of swept overlap, with edge contact alone excluded.
export function contactTime(a: Rect, end: Point, b: Rect, bEnd: Point): number | undefined {
  if (!sweptContact(a, end, b, bEnd)) {
    return undefined;
  }
  let enter = 0;
  for (const axis of ["x", "y"] as const) {
    const length = axis === "x" ? "width" : "height";
    const velocity = end[axis] - a[axis] - (bEnd[axis] - b[axis]);
    if (velocity !== 0) {
      enter = Math.max(
        enter,
        Math.min(
          (b[axis] - a[axis] - a[length]) / velocity,
          (b[axis] + b[length] - a[axis]) / velocity,
        ),
      );
    }
  }
  return enter;
}

export function stepTransients(
  bounds: Rect,
  solids: readonly Rect[],
  ledges: readonly Rect[],
  seconds: number,
  birdBefore: Rect,
  birdAfter: Rect,
  events: readonly SpawnEvent[],
  existing: readonly Transient[],
  nextId: number,
): {
  readonly contact?: Extract<DeathContact, { readonly kind: "transient" }>;
  readonly entities: readonly Transient[];
  readonly nextId: number;
  readonly lethal: boolean;
} {
  if (seconds <= 0) {
    return { entities: existing, lethal: false, nextId };
  }
  let id = nextId;
  const entities: Transient[] = [];
  const occupancy: { entity: Transient; until: number }[] = [];
  let lethal = false;
  let lethalContact: Extract<DeathContact, { readonly kind: "transient" }> | undefined;
  const interpolate = (time: number): Rect => ({
    ...birdBefore,
    x: birdBefore.x + ((birdAfter.x - birdBefore.x) * time) / seconds,
    y: birdBefore.y + ((birdAfter.y - birdBefore.y) * time) / seconds,
  });
  const advance = (entity: Transient, start: number) => {
    const dt = Math.min(seconds - start, entity.lifeSeconds - entity.age);
    if (dt <= 0) {
      return;
    }
    const occupied = { entity, until: start + dt };
    occupancy.push(occupied);
    const after = {
      x: entity.at.x + entity.velocity.x * dt,
      y: entity.at.y + entity.velocity.y * dt + (entity.gravity * dt * dt) / 2,
    };
    const box = transientBox(entity);
    const end = transientBox(entity, after);
    let landing = Infinity;
    for (const solid of solids) {
      const contact = contactTime(box, end, solid, solid);
      if (contact !== undefined) {
        landing = Math.min(landing, contact);
      }
    }
    if (end.y > box.y) {
      for (const top of [...solids, ...ledges]) {
        if (box.y + box.height > top.y || end.y + box.height < top.y) {
          continue;
        }
        const fraction = (top.y - box.y - box.height) / (end.y - box.y);
        const x = box.x + (end.x - box.x) * fraction;
        if (x < top.x + top.width && x + box.width > top.x) {
          landing = Math.min(landing, fraction);
        }
      }
    }
    if (landing !== Infinity) {
      occupied.until = start + dt * landing;
    }
    const armedAfter = Math.max(0, entity.armSeconds - entity.age);
    if (armedAfter <= dt) {
      const fraction = armedAfter / dt;
      const armedBox = {
        ...box,
        x: box.x + (end.x - box.x) * fraction,
        y: box.y + (end.y - box.y) * fraction,
      };
      const contact = contactTime(
        armedBox,
        end,
        interpolate(start + armedAfter),
        interpolate(start + dt),
      );
      if (contact !== undefined && fraction + contact * (1 - fraction) < landing) {
        lethal = true;
        lethalContact ??= {
          emitter: entity.emitter,
          id: entity.id,
          kind: "transient",
          ...(entity.object.contactCue && { contactCue: entity.object.contactCue }),
        };
      }
    }
    if (
      landing !== Infinity ||
      entity.age + dt >= entity.lifeSeconds ||
      after.x + entity.object.width < bounds.x ||
      after.x > bounds.x + bounds.width ||
      after.y > bounds.y + bounds.height ||
      after.y + entity.object.height < bounds.y
    ) {
      return;
    }
    occupied.until = Infinity;
    entities.push({
      ...entity,
      age: entity.age + dt,
      at: after,
      velocity: { x: entity.velocity.x, y: entity.velocity.y + entity.gravity * dt },
    });
  };
  for (const entity of existing) {
    advance(entity, 0);
  }
  for (const event of [...events].sort((a, b) => a.time - b.time)) {
    const action = event.action;
    if (action.kind !== "spawn") {
      continue;
    }
    if (
      occupancy.filter(
        ({ entity, until }) =>
          event.time < until &&
          entity.emitter === event.emitter &&
          entity.object.character === action.character,
      ).length >= action.maxAlive
    ) {
      continue;
    }
    const entity: Transient = {
      age: 0,
      armSeconds: action.armSeconds,
      at: {
        x:
          event.at.x +
          (action.mirrorWithFacing && event.facing === -1
            ? event.emitterWidth - action.offset.x - event.template.width
            : action.offset.x),
        y: event.at.y + action.offset.y,
      },
      emitter: event.emitter,
      gravity: action.gravity,
      id: id++,
      lifeSeconds: action.lifeSeconds,
      object: event.template,
      velocity: {
        ...action.velocity,
        x: action.velocity.x * (action.mirrorWithFacing ? event.facing : 1),
      },
      ...(action.armingAnimation && { armingAnimation: action.armingAnimation }),
    };
    if (event.time >= seconds) {
      entities.push(entity);
      occupancy.push({ entity, until: Infinity });
    } else {
      advance(entity, event.time);
    }
  }
  return { ...(lethalContact && { contact: lethalContact }), entities, lethal, nextId: id };
}
