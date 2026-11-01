import { randomStream } from "@andornaut/game-kit/random";

import type {
  AreaLayout,
  AreaLink,
  BirdTuning,
  DeathContact,
  DialogueLine,
  ObjectLayout,
  Point,
  Rect,
  Size,
  ZoneDeath,
  ZoneLayout,
} from "../data/types";
import {
  type BehaviourState,
  type BehaviourStep,
  contactBox,
  startBehaviour,
  stepBehaviour,
  sweptContact,
} from "./behaviour";
import type { BehaviourWorld } from "./behaviourReach";
import {
  birdBox,
  birdFrameRect,
  type BirdInput,
  type BirdState,
  EDGE,
  startBird,
  stepBird,
} from "./bird";
import { contactFrameAt, silhouetteContact } from "./bodyContact";
import { collisionCandidates } from "./collisionIndex";
import { deathSupport } from "./death";
import { type ForcePulse, forcePulseVelocity } from "./force";
import { axisOf, motionTrack, type Track } from "./motion";
import { currentScreen, targetVisible } from "./perception";
import { overlaps } from "./rect";
import { type SpawnEvent, stepTransients, type Transient } from "./transients";
import { validateWalkEntries } from "./zoneLinks";

interface ObjectFrame {
  readonly after: Rect;
  readonly before: Rect;
  readonly behaviour: BehaviourStep | undefined;
  readonly object: ObjectLayout;
}
interface AreaObjects {
  readonly perception: boolean;
  readonly spotted: readonly number[];
  readonly behaviours: readonly number[];
  readonly emptyBehaviours: readonly (BehaviourState | undefined)[];
  readonly fixed: readonly (ObjectFrame | undefined)[];
  readonly fixedHazards: readonly (Rect | undefined)[];
  readonly fixedLedges: readonly Rect[] | undefined;
  readonly fixedSolids: readonly Rect[] | undefined;
  readonly geometry: BehaviourWorld | undefined;
  readonly hazards: readonly number[];
  readonly ledges: readonly number[];
  readonly platforms: readonly number[];
  readonly solids: readonly number[];
}
const AREA_OBJECTS = new WeakMap<AreaLayout, AreaObjects>();
const FIXED_TRACKS = new WeakSet<Track>();

function areaObjects(area: AreaLayout): AreaObjects {
  const cached = AREA_OBJECTS.get(area);
  if (cached) {
    return cached;
  }
  const fixed = area.objects.map((object): ObjectFrame | undefined => {
    const motion = object.motion;
    if (
      object.behaviour ||
      object.reaction.kind !== "none" ||
      (motion.algorithm !== "static" && motion.distance !== 0 && motion.speed !== 0)
    ) {
      return undefined;
    }
    const rect = rectAt(object, object.origin);
    return { after: rect, before: rect, behaviour: undefined, object };
  });
  const indices = (collision: string) =>
    area.objects.flatMap((object, index) => (object.collision === collision ? [index] : []));
  const solids = indices("solid");
  const ledges = indices("ledge");
  const platforms = area.objects.flatMap((object, index) =>
    object.collision === "solid" || object.collision === "ledge" ? [index] : [],
  );
  const fixedRects = (entries: readonly number[]) =>
    entries.every((index) => fixed[index])
      ? entries.map((index) => fixed[index]!.after)
      : undefined;
  const solidRects = fixedRects(solids);
  const geometry = platforms.every((index) => fixed[index])
    ? {
        ...(platforms.length > 0 && {
          platforms: platforms.map((index) => ({
            collision: area.objects[index]!.collision as "solid" | "ledge",
            owner: area.objects[index]!,
            rect: fixed[index]!.before,
          })),
        }),
        solids: area.solids,
      }
    : undefined;
  const result: AreaObjects = {
    behaviours: area.objects.flatMap((object, index) => (object.behaviour ? [index] : [])),
    emptyBehaviours: area.objects.map(() => undefined),
    fixed,
    fixedHazards: fixed.map((frame) =>
      frame && frame.object.collision === "hazard"
        ? frame.object.hitbox
          ? {
              ...frame.object.hitbox,
              x: frame.after.x + frame.object.hitbox.x,
              y: frame.after.y + frame.object.hitbox.y,
            }
          : frame.after
        : undefined,
    ),
    fixedLedges: fixedRects(ledges),
    fixedSolids:
      solidRects && (solidRects.length > 0 ? [...area.solids, ...solidRects] : area.solids),
    geometry,
    hazards: indices("hazard"),
    ledges,
    perception: area.objects.some((object) => {
      const plan = object.behaviour;
      return (
        plan !== undefined &&
        (plan.spotted !== undefined ||
          Object.values(plan.states).some((node) =>
            node.transitions.some((transition) =>
              transition.when.some((condition) => condition.kind === "visible"),
            ),
          ))
      );
    }),
    platforms,
    solids,
    spotted: area.objects.flatMap((object, index) => (object.behaviour?.spotted ? [index] : [])),
  };
  AREA_OBJECTS.set(area, result);
  return result;
}

function behaviourGeometry(area: AreaLayout, zone: ZoneState): BehaviourWorld {
  const cached = areaObjects(area);
  if (
    cached.geometry &&
    cached.platforms.every((index) => {
      const at = zone.objects[index] ?? area.objects[index]!.origin;
      const origin = area.objects[index]!.origin;
      return at.x === origin.x && at.y === origin.y;
    })
  ) {
    return cached.geometry;
  }
  const platforms = cached.platforms.map((index) => {
    const object = area.objects[index]!;
    return {
      collision: object.collision as "solid" | "ledge",
      owner: object,
      rect: rectAt(object, zone.objects[index] ?? object.origin),
    };
  });
  return { platforms, solids: area.solids };
}

// What the player asks of the zone this step: the bird's input, and whether Use is held. Use
// acts on the step it goes down.
export interface ZoneInput extends BirdInput {
  readonly useHeld: boolean;
}

// area: the area she is in. attempt: 0, and one more after each restart; it reseeds the random
// motion, so a restart does not replay it. objects: each of the area's objects' top-left corner.
// seconds: time since she entered the area, which places the objects on their tracks. door: the
// index among the area's objects of the door she used, which holds the zone still while it
// opens and its room shows, until leaveRoom. cleared: she reached the area's last column, and
// turnedBack: she went back into its first column; either holds it still for good, cleared
// completing the zone and turnedBack leaving it as it was.
export interface ZonePulse extends ForcePulse {
  readonly id: number;
  readonly visual?: {
    readonly art: string;
    readonly animation: string;
    readonly offset: Point;
    readonly at: Point;
    readonly actor: ObjectLayout;
  };
}

export interface ZoneState {
  readonly spotted: Readonly<Record<string, readonly number[]>>;
  readonly barks: readonly DialogueLine[];
  readonly nextPulseId: number;
  readonly pulses: readonly ZonePulse[];
  readonly transients: readonly Transient[];
  readonly nextTransientId: number;
  readonly area: string;
  readonly attempt: number;
  readonly behaviours: readonly (BehaviourState | undefined)[];
  readonly bird: BirdState;
  readonly cleared: boolean;
  readonly death: ZoneDeath | undefined;
  readonly door: number | undefined;
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
  tuning: BirdTuning,
  layout: ZoneLayout,
  link: AreaLink,
  zone: Pick<ZoneState, "attempt" | "restarts" | "seed" | "steps"> &
    Partial<Pick<ZoneState, "spotted">>,
): ZoneState {
  const area = areaOf(layout, link.area);
  const entry = area.entries[link.entry];
  if (!entry) {
    throw new Error(`No entry ${link.entry} in area ${link.area}`);
  }
  const bird = startBird(tuning, entry);
  const tracks = area.objects.map((object, index) =>
    motionTrack(
      object.motion,
      object.phase,
      randomStream(zone.seed + zone.attempt, `${link.area}:${index}`),
    ),
  );
  tracks.forEach((track, index) => {
    const motion = area.objects[index]!.motion;
    if (motion.algorithm === "static" || motion.distance === 0 || motion.speed === 0) {
      FIXED_TRACKS.add(track);
    }
  });
  return {
    ...zone,
    area: link.area,
    barks: [],
    behaviours: area.objects.some((object) => object.behaviour)
      ? area.objects.map((object) => object.behaviour && startBehaviour(tuning, object, bird))
      : [],
    bird,
    cleared: false,
    death: undefined,
    door: undefined,
    nextPulseId: 0,
    nextTransientId: 0,
    objects: area.objects.map((object, index) =>
      object.behaviour ? object.origin : pathAt(object, tracks[index] as Track, 0),
    ),
    pulses: [],
    seconds: 0,
    spotted: zone.spotted ?? {},
    tracks,
    transients: [],
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
  tuning: BirdTuning,
  frame: Size,
  objects: readonly ObjectLayout[],
  at: readonly Point[],
  bird: BirdState,
): number | undefined {
  const drawn = birdFrameRect(tuning, frame, bird);
  const hers = centreOf(birdBox(tuning, bird));
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

export function startZone(tuning: BirdTuning, layout: ZoneLayout, seed: number): ZoneState {
  validateWalkEntries(tuning, layout);
  return enterArea(tuning, layout, layout.start, { attempt: 0, restarts: 0, seed, steps: 0 });
}

// A failed attempt remains frozen until Retry is chosen. Reusing its layout keeps assembled
// terrain while the new attempt reseeds object motion and resets conversations.
export function retryZone(tuning: BirdTuning, layout: ZoneLayout, zone: ZoneState): ZoneState {
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
export function standsOn(tuning: BirdTuning, bird: BirdState, rect: Rect): boolean {
  return (
    Math.abs(bird.y + tuning.height - rect.y) < EDGE &&
    bird.x < rect.x + rect.width &&
    bird.x + tuning.width > rect.x
  );
}

// Where an object goes this step. Without a reaction, it follows its track. Within its reaction's
// range of her it moves along its motion's axis, away from her or toward her; out of range it
// heads back to its track, at the reaction's speed either way.
export function objectStep(
  tuning: BirdTuning,
  object: ObjectLayout,
  seconds: number,
  path: Point,
  bird: BirdState,
  at: Point,
): Point {
  const { reaction } = object;
  if (reaction.kind === "none") {
    return path;
  }
  const reach = reaction.speed * seconds;
  const mine = centreOf(rectAt(object, at));
  const hers = centreOf(birdBox(tuning, bird));
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
  tuning: BirdTuning,
  solids: readonly Rect[],
  dx: number,
  dy: number,
  bird: BirdState,
): BirdState {
  const clear = (x: number, y: number) =>
    !collisionCandidates(solids, { ...birdBox(tuning, bird), x, y }).some((solid) =>
      overlaps({ ...birdBox(tuning, bird), x, y }, solid),
    );
  const x = clear(bird.x + dx, bird.y) ? bird.x + dx : bird.x;
  const y = clear(x, bird.y + dy) ? bird.y + dy : bird.y;
  return { ...bird, x, y };
}

// A solid moving along x into her side pushes her out of its way, to the side she was on before
// it moved: its leading edge, as it runs into her. One that has not moved along x leaves her to
// the bird's own collision, which stops her by her own motion.
export function pushedAside(
  tuning: BirdTuning,
  before: Rect,
  after: Rect,
  bird: BirdState,
): BirdState {
  if (after.x === before.x || !overlaps(birdBox(tuning, bird), after)) {
    return bird;
  }
  const left = bird.x + tuning.width / 2 < before.x + before.width / 2;
  return { ...bird, x: left ? after.x - tuning.width : after.x + after.width };
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
  tuning: BirdTuning,
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
  const kinds = areaObjects(area);
  const baseGeometry = behaviourGeometry(area, zone);
  const geometry = kinds.perception
    ? { ...baseGeometry, view: currentScreen(tuning, area, zone.bird) }
    : baseGeometry;
  const barks: DialogueLine[] = [];
  const seen = new Set(zone.spotted[zone.area] ?? []);
  kinds.spotted.forEach((index) => {
    const object = area.objects[index]!;
    const bark = object.behaviour?.spotted;
    const state = zone.behaviours[index];
    if (
      bark &&
      state?.active &&
      !seen.has(index) &&
      targetVisible(
        geometry,
        object,
        contactBox(object, zone.objects[index] ?? object.origin, state.facing, state.axis),
        birdBox(tuning, zone.bird),
      )
    ) {
      seen.add(index);
      barks.push(bark);
    }
  });
  const spotted = barks.length ? { ...zone.spotted, [zone.area]: [...seen] } : zone.spotted;
  const objects = area.objects.map((object, index): ObjectFrame => {
    const before = zone.objects[index] ?? object.origin;
    const fixed = kinds.fixed[index];
    if (
      fixed &&
      FIXED_TRACKS.has(zone.tracks[index]!) &&
      before.x === object.origin.x &&
      before.y === object.origin.y
    ) {
      return fixed;
    }
    const behaviour = object.behaviour
      ? stepBehaviour(
          tuning,
          object,
          geometry,
          seconds,
          zone.bird,
          before,
          zone.behaviours[index] ?? startBehaviour(tuning, object, zone.bird),
        )
      : undefined;
    const path = pathAt(object, zone.tracks[index] as Track, time);
    const after = behaviour?.at ?? objectStep(tuning, object, seconds, path, zone.bird, before);
    return { after: rectAt(object, after), before: rectAt(object, before), behaviour, object };
  });
  for (const frame of objects) {
    if (frame.behaviour?.escaped) {
      barks.push(frame.behaviour.escaped);
    }
  }
  const positions = objects.map((frame, index): Point =>
    frame === kinds.fixed[index] ? frame.object.origin : { x: frame.after.x, y: frame.after.y },
  );
  let behaviours = zone.behaviours;
  if (behaviours.length > 0) {
    const next = kinds.emptyBehaviours.slice();
    for (const index of kinds.behaviours) {
      next[index] = objects[index]!.behaviour?.state;
    }
    behaviours = next;
  }
  const platforms = kinds.platforms.map((index) => objects[index]!);
  const riding = platforms.find(({ before }) => standsOn(tuning, zone.bird, before));
  let bird = zone.bird;
  let dx = 0;
  if (riding) {
    dx = riding.after.x - riding.before.x;
    bird = ride(tuning, area.solids, dx, riding.after.y - riding.before.y, bird);
  }
  // A platform rising into her from below lifts her onto it, rather than meeting her as a wall.
  for (const { after, before } of platforms) {
    const feet = bird.y + tuning.height;
    if (feet <= before.y + EDGE && feet > after.y && overlaps(birdBox(tuning, bird), after)) {
      bird = { ...bird, y: after.y - tuning.height };
    }
  }
  // A solid platform running into her side pushes her ahead of it. Pushed into a solid, she is
  // crushed, which restarts the zone as a hazard does.
  const fixedSolids =
    kinds.fixedSolids && kinds.solids.every((index) => objects[index] === kinds.fixed[index]);
  const solids = fixedSolids
    ? kinds.fixedSolids!
    : [...area.solids, ...kinds.solids.map((index) => objects[index]!.after)];
  let crushed = false;
  for (const { after, before, object } of platforms) {
    const pushed = object.collision === "solid" ? pushedAside(tuning, before, after, bird) : bird;
    if (pushed !== bird) {
      bird = pushed;
      crushed ||= solids.some((solid) => overlaps(birdBox(tuning, bird), solid));
    }
  }
  const hazardIndices = kinds.hazards.filter((index) => !objects[index]!.object.contact);
  const hazards = hazardIndices.map((index) => {
    const { after, behaviour, object } = objects[index]!;
    return (
      (objects[index] === kinds.fixed[index] ? kinds.fixedHazards[index] : undefined) ??
      (behaviour
        ? contactBox(object, after, behaviour.state.facing, behaviour.state.axis)
        : object.hitbox
          ? { ...object.hitbox, x: after.x + object.hitbox.x, y: after.y + object.hitbox.y }
          : after)
    );
  });
  const fixedLedges =
    kinds.fixedLedges && kinds.ledges.every((index) => objects[index] === kinds.fixed[index]);
  const ledges = fixedLedges
    ? kinds.fixedLedges!
    : kinds.ledges.map((index) => objects[index]!.after);
  const pulses: ZonePulse[] = [...zone.pulses];
  let nextPulseId = zone.nextPulseId;
  const spawns: SpawnEvent[] = [];
  objects.forEach(({ behaviour, object }, emitter) => {
    for (const event of behaviour?.actions ?? []) {
      const action = event.action;
      if (action.kind === "force-pulse") {
        pulses.push({
          id: nextPulseId++,
          ...(action.visual && { visual: { ...action.visual, actor: object, at: event.at } }),
          facing: event.facing,
          height: action.height,
          range: action.range,
          remaining: action.seconds,
          source: contactBox(object, event.at, event.facing, event.axis),
          start: event.time,
          velocity: action.velocity,
        });
      } else {
        const template = object.spawnTemplates?.[action.character];
        if (!template) {
          throw new Error(`No spawn template ${action.character}`);
        }
        spawns.push({ ...event, emitter, emitterWidth: object.width, template });
      }
    }
  });
  const push = forcePulseVelocity(solids, seconds, pulses, birdBox(tuning, bird));
  bird = stepBird(tuning, solids, ledges, seconds, { ...input, push }, bird);
  const remainingPulses = pulses.flatMap((pulse) => {
    const remaining = pulse.remaining - Math.max(0, seconds - pulse.start);
    return remaining > 0 ? [{ ...pulse, remaining, start: 0 }] : [];
  });
  const transientStep = stepTransients(
    { height: area.height, width: area.width, x: 0, y: 0 },
    solids,
    ledges,
    seconds,
    birdBox(tuning, zone.bird),
    birdBox(tuning, bird),
    spawns,
    zone.transients,
    zone.nextTransientId,
  );
  if (riding && !bird.grounded) {
    bird = { ...bird, carryVx: dx / seconds };
  }
  const box = birdBox(tuning, bird);
  const beforeBox = birdBox(tuning, zone.bird);
  const birdAt = (time: number): Rect => ({
    ...beforeBox,
    x: beforeBox.x + ((box.x - beforeBox.x) * time) / seconds,
    y: beforeBox.y + ((box.y - beforeBox.y) * time) / seconds,
  });
  const swept =
    zone.behaviours.length > 0 && seconds > 0
      ? kinds.hazards.find((index) => {
          const { behaviour, object } = objects[index]!;
          return behaviour?.segments.some((segment) => {
            if (object.contact) {
              if (!segment.frame) {
                throw new Error(`Missing silhouette sweep frame for ${object.art}`);
              }
              return silhouetteContact(
                object,
                segment.frame,
                (segment.axis ?? object.behaviour?.axis) === "x" && segment.facing === -1,
                segment.from,
                segment.to,
                birdAt(segment.start),
                birdAt(segment.end),
              );
            }
            const before = contactBox(object, segment.from, segment.facing, segment.axis);
            const after = contactBox(object, segment.to, segment.facing, segment.axis);
            return sweptContact(before, after, birdAt(segment.start), birdAt(segment.end));
          });
        })
      : undefined;
  const bodyContact = kinds.hazards.find((index) => {
    const { after, behaviour, object } = objects[index]!;
    if (!object.contact) {
      return false;
    }
    const state = behaviour?.state;
    if (!state?.animationTag) {
      throw new Error(`Missing silhouette pose for ${object.art}`);
    }
    const frame = contactFrameAt(
      object.contact,
      state.animationTag,
      state.animationSeconds ?? 0,
    ).frame;
    return silhouetteContact(
      object,
      frame,
      (state.axis ?? object.behaviour?.axis) === "x" && state.facing === -1,
      after,
      after,
      box,
      box,
    );
  });
  const overlap = hazards.findIndex((hazard) => overlaps(box, hazard));
  const objectContact = (index: number): DeathContact => {
    const { contactCue } = objects[index]!.object;
    return { index, kind: "object", ...(contactCue && { contactCue }) };
  };
  const contact =
    crushed || bird.y > area.height
      ? undefined
      : bodyContact !== undefined
        ? objectContact(bodyContact)
        : (transientStep.contact ??
          (swept !== undefined
            ? objectContact(swept)
            : overlap >= 0
              ? objectContact(hazardIndices[overlap]!)
              : undefined));
  const steps = zone.steps + 1;
  if (
    bodyContact !== undefined ||
    transientStep.lethal ||
    crushed ||
    swept !== undefined ||
    bird.y > area.height ||
    overlap >= 0
  ) {
    const frozen: ZoneState = {
      ...zone,
      barks,
      behaviours,
      bird,
      nextPulseId,
      nextTransientId: transientStep.nextId,
      objects: positions,
      pulses: remainingPulses,
      seconds: time,
      spotted,
      steps,
      transients: transientStep.entities,
      useHeld: input.useHeld,
    };
    return {
      ...frozen,
      death: {
        ...(contact && { contact }),
        position: { x: bird.x, y: bird.y },
        reason: crushed ? "crush" : bird.y > area.height ? "fall" : "hazard",
        support: deathSupport(tuning, layout, frozen, bird),
        velocity: { x: bird.vx, y: bird.vy },
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
      spotted,
      steps,
    });
    return {
      ...arrival,
      barks,
      bird: { ...arrival.bird, facing: bird.facing, jumpHeld: input.jumpHeld },
    };
  }
  const usePressed = input.useHeld && !zone.useHeld;
  const door = usePressed
    ? doorAt(tuning, layout.birdFrame, area.objects, positions, bird)
    : undefined;
  return {
    ...zone,
    barks,
    behaviours,
    bird,
    cleared: box.x + box.width > area.exitX,
    door,
    nextPulseId,
    nextTransientId: transientStep.nextId,
    objects: positions,
    pulses: remainingPulses,
    seconds: time,
    spotted,
    steps,
    transients: transientStep.entities,
    turnedBack: box.x < area.backX,
    useHeld: input.useHeld,
  };
}
