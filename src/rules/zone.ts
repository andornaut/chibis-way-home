import { randomStream } from "@andornaut/game-kit/random";

import type {
  AreaLayout,
  AreaLink,
  DuckTuning,
  ObjectLayout,
  Point,
  Rect,
  Size,
  ZoneDeath,
  ZoneLayout,
} from "../data/types";
import {
  type BehaviourState,
  contactBox,
  startBehaviour,
  stepBehaviour,
  sweptContact,
} from "./behaviour";
import type { BehaviourWorld } from "./behaviourReach";
import { deathSupport } from "./death";
import {
  duckBox,
  duckFrameRect,
  type DuckInput,
  type DuckState,
  EDGE,
  startDuck,
  stepDuck,
} from "./duck";
import { axisOf, motionTrack, type Track } from "./motion";
import { overlaps } from "./rect";
import { validateWalkEntries } from "./zoneLinks";

const PLATFORM_INDICES = new WeakMap<readonly ObjectLayout[], readonly number[]>();
function behaviourGeometry(area: AreaLayout, zone: ZoneState): BehaviourWorld {
  let indices = PLATFORM_INDICES.get(area.objects);
  if (!indices) {
    indices = area.objects.flatMap((object, index) =>
      object.collision === "solid" || object.collision === "ledge" ? [index] : [],
    );
    PLATFORM_INDICES.set(area.objects, indices);
  }
  if (indices.length === 0) {
    return { solids: area.solids };
  }
  const platforms = indices.map((index) => {
    const object = area.objects[index] as ObjectLayout;
    return {
      collision: object.collision as "solid" | "ledge",
      owner: object,
      rect: {
        ...(zone.objects[index] ?? object.origin),
        height: object.height,
        width: object.width,
      },
    };
  });
  return { platforms, solids: area.solids };
}

// What the player asks of the zone this step: the duck's input, and whether Use is held. Use
// acts on the step it goes down.
export interface ZoneInput extends DuckInput {
  readonly useHeld: boolean;
}

// area: the area she is in. attempt: 0, and one more after each restart; it reseeds the random
// motion, so a restart does not replay it. objects: each of the area's objects' top-left corner.
// seconds: time since she entered the area, which places the objects on their tracks. door: the
// index among the area's objects of the door she used, which holds the zone still while it
// opens and its room shows, until leaveRoom. cleared: she reached the area's last column, and
// turnedBack: she went back into its first column; either holds it still for good, cleared
// completing the zone and turnedBack leaving it as it was.
export interface ZoneState {
  readonly area: string;
  readonly attempt: number;
  readonly behaviours: readonly (BehaviourState | undefined)[];
  readonly cleared: boolean;
  readonly death: ZoneDeath | undefined;
  readonly door: number | undefined;
  readonly duck: DuckState;
  readonly objects: readonly Point[];
  readonly restarts: number;
  readonly seconds: number;
  readonly seed: number;
  readonly steps: number;
  readonly tracks: readonly Track[];
  readonly turnedBack: boolean;
  readonly useHeld: boolean;
}

export function areaOf(layout: ZoneLayout, area: string): AreaLayout {
  const found = layout.areas[area];
  if (!found) {
    throw new Error(`No area ${area}`);
  }
  return found;
}

function rectAt(object: ObjectLayout, at: Point): Rect {
  return { ...at, height: object.height, width: object.width };
}

function pathAt(object: ObjectLayout, track: Track, seconds: number): Point {
  const offset = track.at(seconds);
  return { x: object.origin.x + offset.x, y: object.origin.y + offset.y };
}

// She arrives at the entry `link` names, the area's objects at the start of their tracks. The
// tracks' random draws come from the seed and the attempt, so each attempt rolls them afresh.
export function enterArea(
  tuning: DuckTuning,
  layout: ZoneLayout,
  link: AreaLink,
  zone: Pick<ZoneState, "attempt" | "restarts" | "seed" | "steps">,
): ZoneState {
  const area = areaOf(layout, link.area);
  const entry = area.entries[link.entry];
  if (!entry) {
    throw new Error(`No entry ${link.entry} in area ${link.area}`);
  }
  const duck = startDuck(tuning, entry);
  const tracks = area.objects.map((object, index) =>
    motionTrack(
      object.motion,
      object.phase,
      randomStream(zone.seed + zone.attempt, `${link.area}:${index}`),
    ),
  );
  return {
    ...zone,
    area: link.area,
    behaviours: area.objects.some((object) => object.behaviour)
      ? area.objects.map((object) => object.behaviour && startBehaviour(tuning, object, duck))
      : [],
    cleared: false,
    death: undefined,
    door: undefined,
    duck,
    objects: area.objects.map((object, index) =>
      object.behaviour ? object.origin : pathAt(object, tracks[index] as Track, 0),
    ),
    seconds: 0,
    tracks,
    turnedBack: false,
    // Use must go down after she arrives, so a press held from before does not act.
    useHeld: true,
  };
}

// She leaves the room she is in for its door, standing where she was, the zone going on from
// where it held still. Use must go down again before it acts.
export function leaveRoom(zone: ZoneState): ZoneState {
  return { ...zone, door: undefined, useHeld: true };
}

// A conversation can activate its patrol only after closing. Re-entering the area creates a
// fresh inactive state again for every patrol with a scene.
export function activateBehaviour(index: number, zone: ZoneState): ZoneState {
  const behaviour = zone.behaviours[index];
  return behaviour === undefined || behaviour.active
    ? zone
    : {
        ...zone,
        behaviours: zone.behaviours.map((state, at) =>
          at === index ? { ...behaviour, active: true } : state,
        ),
      };
}

const centreOf = (rect: Rect): Point => ({
  x: rect.x + rect.width / 2,
  y: rect.y + rect.height / 2,
});

// The door Use opens: of the doors (Use objects) whose drawn rect, placed at, her drawn frame
// intersects at all, the one whose centre is nearest hers; undefined where none is. A door is
// drawn over its whole rect (art's door sprites, tiles and placeholders fill it), so its rect is
// its drawn rect.
export function doorAt(
  tuning: DuckTuning,
  frame: Size,
  objects: readonly ObjectLayout[],
  at: readonly Point[],
  duck: DuckState,
): number | undefined {
  const drawn = duckFrameRect(tuning, frame, duck);
  const hers = centreOf(duckBox(tuning, duck));
  let nearest: { distance: number; index: number } | undefined;
  objects.forEach((object, index) => {
    const placed = at[index];
    if (object.collision !== "use" || placed === undefined) {
      return;
    }
    const rect = rectAt(object, placed);
    if (!overlaps(drawn, rect)) {
      return;
    }
    const mine = centreOf(rect);
    const distance = Math.hypot(mine.x - hers.x, mine.y - hers.y);
    if (nearest === undefined || distance < nearest.distance) {
      nearest = { distance, index };
    }
  });
  return nearest?.index;
}

// The room behind the door she used, if she used one.
export function roomOf(layout: ZoneLayout, zone: ZoneState): string | undefined {
  return zone.door === undefined ? undefined : areaOf(layout, zone.area).objects[zone.door]?.room;
}

export function startZone(tuning: DuckTuning, layout: ZoneLayout, seed: number): ZoneState {
  validateWalkEntries(tuning, layout);
  return enterArea(tuning, layout, layout.start, { attempt: 0, restarts: 0, seed, steps: 0 });
}

// A failed attempt remains frozen until Retry is chosen. Reusing its layout keeps assembled
// terrain while the new attempt reseeds object motion and resets conversations.
export function retryZone(tuning: DuckTuning, layout: ZoneLayout, zone: ZoneState): ZoneState {
  return zone.death === undefined
    ? zone
    : enterArea(tuning, layout, layout.start, {
        attempt: zone.attempt + 1,
        restarts: zone.restarts + 1,
        seed: zone.seed,
        steps: zone.steps,
      });
}

// Whether her feet are on top of rect.
export function standsOn(tuning: DuckTuning, duck: DuckState, rect: Rect): boolean {
  return (
    Math.abs(duck.y + tuning.height - rect.y) < EDGE &&
    duck.x < rect.x + rect.width &&
    duck.x + tuning.width > rect.x
  );
}

// Where an object goes this step. Without a reaction, it follows its track. Within its reaction's
// range of her it moves along its motion's axis, away from her or toward her; out of range it
// heads back to its track, at the reaction's speed either way.
export function objectStep(
  tuning: DuckTuning,
  object: ObjectLayout,
  seconds: number,
  path: Point,
  duck: DuckState,
  at: Point,
): Point {
  const { reaction } = object;
  if (reaction.kind === "none") {
    return path;
  }
  const reach = reaction.speed * seconds;
  const mine = centreOf(rectAt(object, at));
  const hers = centreOf(duckBox(tuning, duck));
  if (Math.hypot(hers.x - mine.x, hers.y - mine.y) <= reaction.range) {
    const axis = axisOf(object.motion.direction);
    const toward = (hers.x - mine.x) * axis.x + (hers.y - mine.y) * axis.y >= 0 ? 1 : -1;
    const sign = reaction.kind === "approach" ? toward : -toward;
    return { x: at.x + axis.x * sign * reach, y: at.y + axis.y * sign * reach };
  }
  const dx = path.x - at.x;
  const dy = path.y - at.y;
  const away = Math.hypot(dx, dy);
  return away <= reach ? path : { x: at.x + (dx / away) * reach, y: at.y + (dy / away) * reach };
}

// Moves her with the platform she rides, by (dx, dy), along each axis only as far as no solid
// is in the way.
function ride(
  tuning: DuckTuning,
  solids: readonly Rect[],
  dx: number,
  dy: number,
  duck: DuckState,
): DuckState {
  const clear = (x: number, y: number) =>
    !solids.some((solid) => overlaps({ ...duckBox(tuning, duck), x, y }, solid));
  const x = clear(duck.x + dx, duck.y) ? duck.x + dx : duck.x;
  const y = clear(x, duck.y + dy) ? duck.y + dy : duck.y;
  return { ...duck, x, y };
}

// A solid moving along x into her side pushes her out of its way, to the side she was on before
// it moved: its leading edge, as it runs into her. One that has not moved along x leaves her to
// the duck's own collision, which stops her by her own motion.
export function pushedAside(
  tuning: DuckTuning,
  before: Rect,
  after: Rect,
  duck: DuckState,
): DuckState {
  if (after.x === before.x || !overlaps(duckBox(tuning, duck), after)) {
    return duck;
  }
  const left = duck.x + tuning.width / 2 < before.x + before.width / 2;
  return { ...duck, x: left ? after.x - tuning.width : after.x + after.width };
}

// One fixed step of the zone. Pure, so the game and a headless simulator run the same rules.
// Solid objects block like terrain and ledge objects only from above; standing on a moving one,
// she moves with it, and leaving it by a jump or a walk off its edge she keeps its speed along x
// until she lands. A solid one running into her side pushes her ahead of it. Touching a hazard,
// being pushed into a solid or falling out of the area freezes a death snapshot until an
// explicit retry starts the next attempt. Her box reaching the last column clears the zone, and
// reaching back into its first column ends it uncleared (turnedBack).
// Use with her drawn frame over a door sets `door` (doorAt), and the zone holds still until
// leaveRoom.
export function stepZone(
  tuning: DuckTuning,
  layout: ZoneLayout,
  seconds: number,
  input: ZoneInput,
  zone: ZoneState,
): ZoneState {
  if (zone.death !== undefined || zone.cleared || zone.turnedBack || zone.door !== undefined) {
    return zone;
  }
  const area = areaOf(layout, zone.area);
  const time = zone.seconds + seconds;
  const geometry = behaviourGeometry(area, zone);
  const objects = area.objects.map((object, index) => {
    const before = zone.objects[index] ?? object.origin;
    const behaviour = object.behaviour
      ? stepBehaviour(
          tuning,
          object,
          geometry,
          seconds,
          zone.duck,
          before,
          zone.behaviours[index] ?? startBehaviour(tuning, object, zone.duck),
        )
      : undefined;
    const path = pathAt(object, zone.tracks[index] as Track, time);
    const after = behaviour?.at ?? objectStep(tuning, object, seconds, path, zone.duck, before);
    return { after: rectAt(object, after), before: rectAt(object, before), behaviour, object };
  });
  const platforms = objects.filter(
    ({ object }) => object.collision === "solid" || object.collision === "ledge",
  );
  const riding = platforms.find(({ before }) => standsOn(tuning, zone.duck, before));
  let duck = zone.duck;
  let dx = 0;
  if (riding) {
    dx = riding.after.x - riding.before.x;
    duck = ride(tuning, area.solids, dx, riding.after.y - riding.before.y, duck);
  }
  // A platform rising into her from below lifts her onto it, rather than meeting her as a wall.
  for (const { after, before } of platforms) {
    const feet = duck.y + tuning.height;
    if (feet <= before.y + EDGE && feet > after.y && overlaps(duckBox(tuning, duck), after)) {
      duck = { ...duck, y: after.y - tuning.height };
    }
  }
  const rects = (collision: string) =>
    objects.filter(({ object }) => object.collision === collision).map(({ after }) => after);
  // A solid platform running into her side pushes her ahead of it. Pushed into a solid, she is
  // crushed, which restarts the zone as a hazard does.
  const solids = [...area.solids, ...rects("solid")];
  let crushed = false;
  for (const { after, before, object } of platforms) {
    const pushed = object.collision === "solid" ? pushedAside(tuning, before, after, duck) : duck;
    if (pushed !== duck) {
      duck = pushed;
      crushed ||= solids.some((solid) => overlaps(duckBox(tuning, duck), solid));
    }
  }
  const hazards = objects
    .filter(({ object }) => object.collision === "hazard")
    .map(({ after, behaviour, object }) =>
      behaviour
        ? contactBox(object, after, behaviour.state.facing)
        : object.hitbox
          ? { ...object.hitbox, x: after.x + object.hitbox.x, y: after.y + object.hitbox.y }
          : after,
    );
  duck = stepDuck(tuning, solids, rects("ledge"), seconds, input, duck);
  if (riding && !duck.grounded) {
    duck = { ...duck, carryVx: dx / seconds };
  }
  const box = duckBox(tuning, duck);
  const beforeBox = duckBox(tuning, zone.duck);
  const duckAt = (time: number): Rect => ({
    ...beforeBox,
    x: beforeBox.x + ((box.x - beforeBox.x) * time) / seconds,
    y: beforeBox.y + ((box.y - beforeBox.y) * time) / seconds,
  });
  const swept =
    zone.behaviours.length > 0 &&
    seconds > 0 &&
    objects.some(
      ({ behaviour, object }) =>
        object.collision === "hazard" &&
        behaviour?.segments.some((segment) => {
          const before = contactBox(object, segment.from, segment.facing);
          const after = contactBox(object, segment.to, segment.facing);
          return sweptContact(before, after, duckAt(segment.start), duckAt(segment.end));
        }),
    );
  const steps = zone.steps + 1;
  if (crushed || swept || duck.y > area.height || hazards.some((hazard) => overlaps(box, hazard))) {
    const frozen: ZoneState = {
      ...zone,
      behaviours:
        zone.behaviours.length > 0
          ? objects.map(({ behaviour }) => behaviour?.state)
          : zone.behaviours,
      duck,
      objects: objects.map(({ after }) => ({ x: after.x, y: after.y })),
      seconds: time,
      steps,
      useHeld: input.useHeld,
    };
    return {
      ...frozen,
      death: {
        position: { x: duck.x, y: duck.y },
        reason: crushed ? "crush" : duck.y > area.height ? "fall" : "hazard",
        support: deathSupport(tuning, layout, frozen, duck),
        velocity: { x: duck.vx, y: duck.vy },
      },
    };
  }
  const link =
    box.x < area.backX
      ? area.walkLinks?.left
      : box.x + box.width > area.exitX
        ? area.walkLinks?.right
        : undefined;
  if (link) {
    const arrival = enterArea(tuning, layout, link, {
      attempt: zone.attempt,
      restarts: zone.restarts,
      seed: zone.seed,
      steps,
    });
    return { ...arrival, duck: { ...arrival.duck, facing: duck.facing, jumpHeld: input.jumpHeld } };
  }
  const usePressed = input.useHeld && !zone.useHeld;
  const door = usePressed
    ? doorAt(
        tuning,
        layout.duckFrame,
        area.objects,
        objects.map(({ after }) => after),
        duck,
      )
    : undefined;
  return {
    ...zone,
    behaviours:
      zone.behaviours.length > 0
        ? objects.map(({ behaviour }) => behaviour?.state)
        : zone.behaviours,
    cleared: box.x + box.width > area.exitX,
    door,
    duck,
    objects: objects.map(({ after }) => ({ x: after.x, y: after.y })),
    seconds: time,
    steps,
    turnedBack: box.x < area.backX,
    useHeld: input.useHeld,
  };
}
