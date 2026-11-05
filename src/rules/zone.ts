import { randomStream } from "@andornaut/game-kit/random";
import { rectsOverlap } from "@andornaut/game-kit/rect";

import { namedStreams } from "../ai/randomStreams";
import {
  collisionCandidates,
  contactFrameAt,
  EDGE,
  silhouetteContact,
  spriteFrameOrigin,
  STEP_SECONDS,
  sweptContact,
} from "../core";
import { BEHAVIOUR_TRAVERSAL_SEARCH } from "../data/behaviours";
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
  advanceBehaviour,
  type BehaviourState,
  type BehaviourStep,
  contactBox,
  startBehaviour,
} from "./behaviour";
import { behaviourEffect } from "./behaviourEffects";
import { perceiveBehaviour } from "./behaviourPerception";
import type { BehaviourPlatformFrame, BehaviourWorld, CrumblingPrediction } from "./behaviourReach";
import {
  birdBox,
  birdFrameRect,
  type BirdInput,
  type BirdState,
  ordinaryJumpApexFeetY,
  startBird,
  startsDash,
  stepBirdWithSupport,
} from "./bird";
import { bossDeath, defeatBoss, holdDefeated, removedBoss } from "./bossDefeat";
import { initialCrumblingWorld } from "./crumbling";
import { beginCrumblingFrame, endCrumblingFrame } from "./crumblingFrame";
import { deathSupport } from "./death";
import {
  clockedSupport,
  clockPresent,
  effectiveCollision,
  effectiveHazardPhase,
} from "./effectiveCollision";
import { type ForcePulse, forcePulseVelocity } from "./force";
import {
  forcedTransitBankAdmissions,
  type ForcedTransitState,
  stepForcedTransit,
} from "./forcedTransit";
import {
  type ForcedTransitForecast,
  forcedTransitTakeoffBody,
  forcedTransitTakeoffOrigin,
  forecastForcedTransit,
} from "./forcedTransitForecast";
import { ordinaryTransitControl } from "./forcedTransitProfile";
import { hazardOccupancy } from "./hazardOccupancy";
import { axisOf, motionTrack, type Track } from "./motion";
import { preparePursuitMaps, pursuitGroundMap } from "./movementMaps";
import { orbitHostLegs, type OrbitLeg, orbitPosition, orbitSweptContact, pathLedge } from "./orbit";
import { currentScreen, targetVisible } from "./perception";
import { finishPlatformBird, preparePlatformBird, standsOn } from "./platformBird";
export { standsOn } from "./platformBird";
import { type SceneryPlaybackState, stepSceneryPlayback } from "./sceneryPlayback";
import { timedHazardRect } from "./timedHazard";
import { type SpawnEvent, stepTransients, type Transient } from "./transients";
import {
  clockedSupportPrediction,
  crumblingActorIndices,
  crumblingActors,
  crumblingPrediction,
  joinedPrediction,
  presentTerrain,
  supportPresent,
  type ZoneCrumblingWorld,
} from "./zoneCrumbling";
import { validateWalkEntries } from "./zoneLinks";

interface ObjectFrame {
  readonly orbitLegs?: readonly OrbitLeg[];
  readonly after: Rect;
  readonly before: Rect;
  readonly behaviour: BehaviourStep | undefined;
  readonly object: ObjectLayout;
}
interface AreaObjects {
  // Supports whose behaviour clock decides their presence.
  readonly clockedSupports: readonly number[];
  readonly crumblingActors: readonly number[];
  readonly crumblingObjects: readonly number[];
  readonly forcedTransit: readonly number[];
  readonly perception: boolean;
  // Per object: whether its future platform frames can be sampled by re-stepping it, and
  // whether its behaviour perceives the traversal frame.
  readonly predictable: readonly boolean[];
  readonly traversal: readonly boolean[];
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
  // Ledges on an orbit's path about a static host.
  readonly pathLedges: readonly number[];
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
      object.orbit ||
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
    clockedSupports: platforms.filter((index) => clockedSupport(area.objects[index]!)),
    crumblingActors: area.crumbling ? crumblingActorIndices(area) : [],
    crumblingObjects: area.objects.flatMap((object, index) =>
      area.crumbling?.some(({ supportId }) => supportId === object) ? [index] : [],
    ),
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
    forcedTransit: area.objects.flatMap((object, index) => (object.forcedTransit ? [index] : [])),
    geometry,
    hazards: indices("hazard"),
    ledges,
    pathLedges: ledges.filter((index) => pathLedge(area.objects[index]!)),
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
    predictable: area.objects.map((object) => {
      if (object.orbit || object.reaction.kind !== "none") {
        return false;
      }
      if (!object.behaviour) {
        return (
          object.motion.variance === 0 &&
          ["static", "linear", "ease"].includes(object.motion.algorithm)
        );
      }
      return (
        !object.behaviour.pursuit &&
        Object.values(object.behaviour.states).every(
          ({ motion, onEnter, transitions }) =>
            !onEnter?.length &&
            (motion.kind === "wait" ||
              (motion.kind === "move" && typeof motion.direction === "number")) &&
            transitions.every(({ when }) =>
              when.every(({ kind }) => kind === "elapsed" || kind === "boundary"),
            ),
        )
      );
    }),
    solids,
    spotted: area.objects.flatMap((object, index) => (object.behaviour?.spotted ? [index] : [])),
    traversal: area.objects.map(
      (object) =>
        object.behaviour !== undefined &&
        object.collision !== "solid" &&
        object.collision !== "ledge" &&
        Object.values(object.behaviour.states).some(
          ({ motion }) =>
            motion.kind === "pursue" &&
            (motion.mode === "fly" || (motion.mode === "ground" && motion.traversal !== undefined)),
        ),
    ),
  };
  AREA_OBJECTS.set(area, result);
  return result;
}

function behaviourGeometry(
  area: AreaLayout,
  terrain: readonly Rect[],
  present: (index: number) => boolean,
  zone: ZoneState,
): BehaviourWorld {
  const cached = areaObjects(area);
  if (
    cached.geometry &&
    terrain === area.solids &&
    cached.platforms.every((index) => {
      const at = zone.objects[index] ?? area.objects[index]!.origin;
      const origin = area.objects[index]!.origin;
      return at.x === origin.x && at.y === origin.y && present(index);
    })
  ) {
    return cached.geometry;
  }
  const platforms = cached.platforms.filter(present).map((index) => {
    const object = area.objects[index]!;
    return {
      collision: object.collision as "solid" | "ledge",
      owner: object,
      rect: rectAt(object, zone.objects[index] ?? object.origin),
    };
  });
  return { platforms, solids: terrain };
}

// What the player asks of the zone this step: the bird's input, and whether Use is held. Use
// acts on the step it goes down.
export interface ZoneInput extends BirdInput {
  readonly useHeld: boolean;
}

// area: the area he is in. attempt: 0, and one more after each restart; it reseeds the random
// motion, so a restart does not replay it. objects: each of the area's objects' top-left corner.
// seconds: time since he entered the area, which places the objects on their tracks. door: the
// index among the area's objects of the door he used, which holds the zone still while it
// opens and its room shows, until leaveRoom. cleared: he reached the area's last column, and
// turnedBack: he went back into its first column; either holds it still for good, cleared
// completing the zone and turnedBack leaving it as it was.
export interface ZonePulse extends ForcePulse {
  readonly id: number;
  readonly visual?: {
    readonly art: string;
    readonly animation: string;
    readonly offset: Point;
    readonly span?: true;
    readonly at: Point;
    readonly actor: ObjectLayout;
  };
}

export interface ZoneBark extends DialogueLine {
  readonly owner: {
    readonly area: string;
    readonly attempt: number;
    readonly objectIndex: number;
  };
}

// Why a boss's pursuit ended as an escape: Chibi got beyond its escape distance (or past an
// authored unreachable grace), or he entered a room door.
type ZoneEscapeCause = "distance" | "door";

// A boss's pursuit ending as an escape on one step. A death step reports none, and a boss's own
// death is never one.
interface ZoneEscape {
  readonly cause: ZoneEscapeCause;
  readonly owner: ZoneBark["owner"];
}

export interface ZoneState {
  // Crumbling support phases and contacts at the latest boundary; reset on area entry.
  readonly crumbling?: ZoneCrumblingWorld | undefined;
  readonly forcedTransit?: ForcedTransitState;
  readonly forcedTransitForecast?: ForcedTransitForecast | undefined;
  readonly sceneryPlayback?: readonly (SceneryPlaybackState | undefined)[] | undefined;
  readonly spotted: Readonly<Record<string, readonly number[]>>;
  // Per area, the bosses that have died this attempt; area links keep them dead, and a retry
  // restores them with the rest of the area.
  readonly defeated?: Readonly<Record<string, readonly number[]>>;
  readonly barks: readonly ZoneBark[];
  // The escapes of the step that produced this state. A held zone returns itself unchanged, so
  // read them when `steps` advances, as barks are.
  readonly escapes: readonly ZoneEscape[];
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

// He arrives at the entry `link` names, the area's objects at the start of their tracks. The
// tracks' random draws come from the seed and the attempt, so each attempt rolls them afresh.
export function enterArea(
  tuning: BirdTuning,
  layout: ZoneLayout,
  link: AreaLink,
  zone: Pick<ZoneState, "attempt" | "restarts" | "seed" | "steps"> &
    Partial<Pick<ZoneState, "defeated" | "spotted">>,
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
    if (
      !area.objects[index]!.orbit &&
      (motion.algorithm === "static" || motion.distance === 0 || motion.speed === 0)
    ) {
      FIXED_TRACKS.add(track);
    }
  });
  const positions = area.objects.map((object, index) =>
    object.behaviour ? object.origin : pathAt(object, tracks[index]!, 0),
  );
  const objects = positions.map((at, index) => {
    const object = area.objects[index]!;
    if (!object.orbit) {
      return at;
    }
    const host = area.objects[object.orbit.host]!;
    return orbitPosition(0, rectAt(host, positions[object.orbit.host]!), object.orbit, object);
  });
  return {
    ...zone,
    area: link.area,
    barks: [],
    behaviours: area.objects.some((object) => object.behaviour)
      ? area.objects.map((object, index) => {
          const state = object.behaviour && startBehaviour(tuning, object, bird);
          return state && zone.defeated?.[link.area]?.includes(index) ? removedBoss(state) : state;
        })
      : [],
    bird,
    cleared: false,
    crumbling: area.crumbling ? initialCrumblingWorld(area.crumbling) : undefined,
    death: undefined,
    door: undefined,
    escapes: [],
    nextPulseId: 0,
    nextTransientId: 0,
    objects,
    pulses: [],
    sceneryPlayback: undefined,
    seconds: 0,
    spotted: zone.spotted ?? {},
    tracks,
    transients: [],
    turnedBack: false,
    // Use must go down after he arrives, so a press held from before does not act.
    useHeld: true,
  };
}

// He leaves the room he is in for its door, standing where he was, the zone going on from
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

// The door Use opens: of the doors (Use objects) whose drawn rect, placed at, his drawn frame
// intersects at all, the one whose centre is nearest his; undefined where none is. A door is
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
    if (!rectsOverlap(drawn, rect)) {
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

// The room behind the door he used, if he used one.
export function roomOf(layout: ZoneLayout, zone: ZoneState): string | undefined {
  return zone.door === undefined ? undefined : areaOf(layout, zone.area).objects[zone.door]?.room;
}

// Zone start builds every area's pursuit maps, so no play step builds one.
export function startZone(tuning: BirdTuning, layout: ZoneLayout, seed: number): ZoneState {
  validateWalkEntries(tuning, layout);
  preparePursuitMaps(layout);
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

// Observes only this tick's present supports: terrain and platforms that crumbling has not removed.
function transitObservation(
  skillProfiles: readonly BirdTuning[],
  tuning: BirdTuning,
  area: AreaLayout,
  kinds: AreaObjects,
  seconds: number,
  terrain: readonly Rect[],
  presentPlatforms: readonly number[],
  zone: ZoneState,
): ForcedTransitState | undefined {
  if (kinds.forcedTransit.length === 0 && !zone.forcedTransit) {
    return undefined;
  }
  const supports = presentPlatforms.map((index) => ({
    index,
    object: area.objects[index]!,
    rect: rectAt(area.objects[index]!, zone.objects[index] ?? area.objects[index]!.origin),
  }));
  const support = supports.find(({ rect }) => standsOn(tuning, zone.bird, rect));
  const box = birdBox(tuning, zone.bird);
  const terrainContact =
    zone.bird.grounded &&
    collisionCandidates(terrain, box).some((rect) => standsOn(tuning, zone.bird, rect));
  // Grounded only on a present support; a removed support's former top is not ground.
  const grounded = terrainContact || (zone.bird.grounded && support !== undefined);
  const bankAdmissions = grounded
    ? forcedTransitBankAdmissions(
        kinds.forcedTransit.map((index) => area.objects[index]!.forcedTransit!),
        box,
      )
    : [];
  const safeGround =
    grounded &&
    (terrainContact ||
      supports.some(
        ({ object, rect }) => !object.forcedTransit && standsOn(tuning, zone.bird, rect),
      ));
  const takeoffOrigin =
    support &&
    forcedTransitTakeoffOrigin(
      { area: zone.area, attempt: zone.attempt, dtSeconds: seconds, seconds: zone.seconds },
      zone.bird,
      {
        ...support,
        owner: support.object,
        state: zone.behaviours[support.index],
        track: zone.tracks[support.index]!,
      },
      zone.forcedTransitForecast,
    );
  const takeoffBody =
    support &&
    forcedTransitTakeoffBody(
      { area: zone.area, attempt: zone.attempt, dtSeconds: seconds, seconds: zone.seconds },
      {
        bird: zone.bird,
        skillProfiles,
        terrainSolids: terrain,
        tuning,
        unknownPush: zone.pulses.length > 0,
      },
      {
        ...support,
        owner: support.object,
        state: zone.behaviours[support.index],
        track: zone.tracks[support.index]!,
      },
      zone.forcedTransitForecast,
    );
  return stepForcedTransit(
    {
      bankAdmissions,
      grounded,
      ordinaryControl: ordinaryTransitControl(skillProfiles, tuning, zone.bird),
      riderBodyOrigin: { x: zone.bird.x, y: zone.bird.y },
      safeGround,
      ...(support && {
        support: {
          index: support.index,
          ordinaryJumpApexFeetY: takeoffBody
            ? ordinaryJumpApexFeetY(tuning, takeoffBody.takeoff.y)
            : undefined,
          ordinaryTakeoffOrigin: takeoffOrigin,
          origin: { x: support.rect.x, y: support.rect.y },
          ...(support.object.forcedTransit && { transit: support.object.forcedTransit }),
        },
      }),
    },
    zone.forcedTransit,
  );
}

// Where an object goes this step. Without a reaction, it follows its track. Within its reaction's
// range of him it moves along its motion's axis, away from him or toward him; out of range it
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

// The physical part of one live zone step: object frames, with every behaviour object's perceive,
// decide and act, crumbling, forced transit, Chibi's body, transients, contact and death.
// stepZone adds spotting and escape barks, walk links and the stage exit to it.
interface ZoneBodyStep {
  // The objects whose pursuit ended this step by distance, each with its escape bark.
  readonly escapes: readonly { readonly bark: DialogueLine; readonly index: number }[];
  // The behaviour world the objects perceived at the start of the step.
  readonly geometry: BehaviourWorld;
  // The zone after the step, without its barks, walk link or exit; a death freezes it.
  readonly zone: ZoneState;
}

// Requires a live zone: no death, door, clear or turn back.
export function stepZoneBodies(
  skillProfiles: readonly BirdTuning[],
  tuning: BirdTuning,
  layout: ZoneLayout,
  seconds: number,
  input: ZoneInput,
  zone: ZoneState,
): ZoneBodyStep {
  const area = areaOf(layout, zone.area);
  const time = zone.seconds + seconds;
  const playbackView = area.objects.some((object) => object.motion.playback === "once-visible")
    ? currentScreen(tuning, area, zone.bird)
    : undefined;
  const playback =
    playbackView &&
    area.objects.map((object, index) =>
      object.motion.playback === "once-visible"
        ? stepSceneryPlayback(
            { seconds, track: zone.tracks[index]!, view: playbackView },
            object,
            zone.sceneryPlayback?.[index],
          )
        : undefined,
    );
  const sceneryPlayback = playback?.map((frame) => frame?.state);

  const kinds = areaObjects(area);
  // A dead boss is no longer a body.
  const bodies = kinds.crumblingActors.filter((index) => !zone.behaviours[index]?.defeat);
  // One shared phase commit at the boundary, before any collider is constructed this tick.
  const prior =
    zone.crumbling ?? (area.crumbling ? initialCrumblingWorld(area.crumbling) : undefined);
  const crumbling =
    prior &&
    beginCrumblingFrame(
      area.crumbling!,
      {
        ...crumblingActors(
          tuning,
          area,
          bodies,
          undefined,
          zone.objects,
          zone.transients,
          zone.bird,
        ),
        timeSeconds: zone.seconds,
      },
      prior,
    );
  // Clocked supports collide by their state at the start of the step.
  const present = (index: number) =>
    (!kinds.crumblingObjects.includes(index) || supportPresent(crumbling, area.objects[index]!)) &&
    (!kinds.clockedSupports.includes(index) ||
      clockPresent(area.objects[index]!, zone.behaviours[index]));
  const terrain = presentTerrain(crumbling, area.solids);
  const presentPlatforms = kinds.platforms.filter(present);
  const forcedTransit = transitObservation(
    skillProfiles,
    tuning,
    area,
    kinds,
    seconds,
    terrain,
    presentPlatforms,
    zone,
  );
  const baseGeometry = {
    ...behaviourGeometry(area, terrain, present, zone),
    chunks: area.chunks,
    hazards: kinds.hazards.flatMap((index) => {
      const object = area.objects[index]!;
      if (zone.behaviours[index]?.defeat) {
        return [];
      }
      const at = { ...(zone.objects[index] ?? object.origin) };
      const state = zone.behaviours[index];
      const rect = object.contact
        ? { ...spriteFrameOrigin(object.contact.frame, object, at), ...object.contact.frame }
        : contactBox(object, at, state?.facing ?? 1, state?.axis);
      const dynamic =
        object.orbit !== undefined ||
        object.behaviour !== undefined ||
        object.motion.algorithm !== "static" ||
        object.reaction.kind !== "none";
      return [
        {
          ...(dynamic
            ? hazardOccupancy(tuning, area.objects, state, at, rect, zone.seconds, object)
            : { rect }),
          owner: object,
        },
      ];
    }),
    targetedAttackWindow: forcedTransit?.attackWindow ?? "allowed",
  };
  const geometry = kinds.perception
    ? { ...baseGeometry, view: currentScreen(tuning, area, zone.bird) }
    : baseGeometry;
  // Each object's frame this tick, and the objects whose frames are being resolved.
  const frames: (ObjectFrame | undefined)[] = new Array(area.objects.length);
  const resolving = new Uint8Array(area.objects.length);
  let supportFrames: readonly BehaviourPlatformFrame[] | undefined;
  let futureSupports:
    ((time: number, dt: number) => readonly BehaviourPlatformFrame[] | undefined) | undefined;
  // Every perceiver this tick shares the area bounds and the crumbling prediction.
  let traversalShared:
    { readonly bounds: Rect; readonly crumbling: CrumblingPrediction | undefined } | undefined;
  const traversalGeometry = (owner: ObjectLayout): BehaviourWorld => {
    supportFrames ??= presentPlatforms.map((index): BehaviourPlatformFrame => {
      const frame = resolveFrame(index);
      return {
        after: frame.after,
        before: frame.before,
        collision: frame.object.collision as "solid" | "ledge",
        owner: frame.object,
        ...(frame.behaviour && {
          segments: frame.behaviour.segments.map((segment) => ({
            endSeconds: zone.seconds + segment.end,
            from: rectAt(frame.object, segment.from),
            startSeconds: zone.seconds + segment.start,
            to: rectAt(frame.object, segment.to),
          })),
        }),
      };
    });
    futureSupports ??= (() => {
      const samples = [supportFrames!];
      let states = presentPlatforms.map((index) => resolveFrame(index).behaviour?.state);
      const predictable = presentPlatforms.every((index) => kinds.predictable[index]);
      const atTime = (frame: BehaviourPlatformFrame, at: number): Rect => {
        const legs = frame.segments;
        if (!legs?.length) {
          const fraction = Math.max(0, Math.min(1, (at - zone.seconds) / seconds));
          return {
            ...frame.before,
            x: frame.before.x + (frame.after.x - frame.before.x) * fraction,
            y: frame.before.y + (frame.after.y - frame.before.y) * fraction,
          };
        }
        const leg = legs.find(({ endSeconds }) => at <= endSeconds) ?? legs.at(-1)!;
        const fraction = Math.max(
          0,
          Math.min(1, (at - leg.startSeconds) / (leg.endSeconds - leg.startSeconds)),
        );
        return {
          ...leg.from,
          x: leg.from.x + (leg.to.x - leg.from.x) * fraction,
          y: leg.from.y + (leg.to.y - leg.from.y) * fraction,
        };
      };
      const sample = (start: number, dt: number) => {
        const offset = (start - zone.seconds) / seconds;
        const tick = Math.floor(offset + EDGE);
        if (
          tick < 0 ||
          tick > BEHAVIOUR_TRAVERSAL_SEARCH.budget.horizonSteps ||
          dt <= 0 ||
          start + dt > zone.seconds + (tick + 1) * seconds + EDGE
        ) {
          return undefined;
        }
        if (tick > 0 && !predictable) {
          return undefined;
        }
        while (samples.length <= tick) {
          const previous = samples.at(-1)!;
          const time = zone.seconds + samples.length * seconds;
          const futureGeometry = {
            ...geometry,
            platforms: previous.map(({ after, collision, owner }) => ({
              collision,
              owner,
              rect: after,
            })),
          };
          const nextStates: (BehaviourState | undefined)[] = [];
          samples.push(
            presentPlatforms.map((index, slot) => {
              const object = area.objects[index]!;
              const before = previous[slot]!.after;
              const state = states[slot];
              const behaviour =
                object.behaviour && state
                  ? advanceBehaviour(
                      perceiveBehaviour(tuning, futureGeometry, zone.bird),
                      object,
                      seconds,
                      before,
                      state,
                    )
                  : undefined;
              nextStates.push(behaviour?.state);
              const after = rectAt(
                object,
                behaviour?.at ??
                  objectStep(
                    tuning,
                    object,
                    seconds,
                    pathAt(object, zone.tracks[index]!, time + seconds),
                    zone.bird,
                    before,
                  ),
              );
              return {
                after,
                before,
                collision: object.collision as "solid" | "ledge",
                owner: object,
                segments: behaviour
                  ? behaviour.segments.map((leg) => ({
                      endSeconds: time + leg.end,
                      from: rectAt(object, leg.from),
                      startSeconds: time + leg.start,
                      to: rectAt(object, leg.to),
                    }))
                  : [{ endSeconds: time + seconds, from: before, startSeconds: time, to: after }],
              };
            }),
          );
          states = nextStates;
        }
        return samples[tick]!.map((frame) => {
          const startTick = zone.seconds + tick * seconds;
          const whole = frame.segments ?? [
            {
              endSeconds: startTick + seconds,
              from: frame.before,
              startSeconds: startTick,
              to: frame.after,
            },
          ];
          // Clip the exact fixed-step chords at animation/graph slice boundaries.
          const framed = { ...frame, segments: whole };
          const before = atTime(framed, start);
          const after = atTime(framed, start + dt);
          const legs = whole
            .filter((leg) => leg.endSeconds > start && leg.startSeconds < start + dt)
            .map((leg) => ({
              endSeconds: Math.min(start + dt, leg.endSeconds),
              from: atTime(framed, Math.max(start, leg.startSeconds)),
              startSeconds: Math.max(start, leg.startSeconds),
              to: atTime(framed, Math.min(start + dt, leg.endSeconds)),
            }));
          return { ...frame, after, before, segments: legs };
        });
      };
      const clipped = new Map<number, Map<number, readonly BehaviourPlatformFrame[] | undefined>>();
      return (start: number, dt: number) => {
        let durations = clipped.get(start);
        if (durations?.has(dt)) {
          return durations.get(dt);
        }
        const result = sample(start, dt);
        if (!durations) {
          durations = new Map();
          clipped.set(start, durations);
        }
        durations.set(dt, result);
        return result;
      };
    })();
    traversalShared ??= {
      bounds: { height: area.height, width: area.width, x: 0, y: 0 },
      crumbling: joinedPrediction(
        crumbling && crumblingPrediction(area, crumbling, time),
        kinds.clockedSupports.length > 0
          ? clockedSupportPrediction(area, kinds.clockedSupports, zone.behaviours, zone.seconds)
          : undefined,
      ),
    };
    return {
      ...geometry,
      traversalFrame: {
        ...(traversalShared.crumbling && { crumbling: traversalShared.crumbling }),
        bounds: traversalShared.bounds,
        dtSeconds: seconds,
        platforms: supportFrames.filter((frame) => frame.owner !== owner),
        sample: futureSupports,
        timeSeconds: zone.seconds,
      },
    };
  };
  const resolveFrame = (index: number): ObjectFrame => {
    const prior = frames[index];
    if (prior) {
      return prior;
    }
    const object = area.objects[index];
    if (!object || resolving[index]) {
      throw new Error("Invalid runtime orbit relationship");
    }
    resolving[index] = 1;
    const frame: ObjectFrame = (() => {
      if (object.orbit) {
        const host = area.objects[object.orbit.host]!;
        const resolved = resolveFrame(object.orbit.host);
        const before = rectAt(object, zone.objects[index] ?? object.origin);
        const after = rectAt(object, orbitPosition(time, resolved.after, object.orbit, object));
        if (object.collision === "ledge") {
          // A path ledge's static host gives it no legs; it carries by its before and after.
          return { after, before, behaviour: undefined, object };
        }
        const orbitLegs = orbitHostLegs(
          zone.seconds,
          time,
          host,
          zone.tracks[object.orbit.host]!,
          resolved.before,
          resolved.after,
        );
        return { after, before, behaviour: undefined, object, orbitLegs };
      }

      const before = zone.objects[index] ?? object.origin;
      const scenery = playback?.[index];
      if (scenery) {
        return {
          after: rectAt(object, scenery.at),
          before: rectAt(object, before),
          behaviour: undefined,
          object,
        };
      }

      const fixed = kinds.fixed[index];
      if (
        fixed &&
        FIXED_TRACKS.has(zone.tracks[index]!) &&
        before.x === object.origin.x &&
        before.y === object.origin.y
      ) {
        return fixed;
      }
      // Perceive once per object per tick; deciding and acting read only this snapshot.
      const prior = zone.behaviours[index];
      const behaviour = prior?.defeat
        ? holdDefeated(seconds, before, prior)
        : object.behaviour
          ? advanceBehaviour(
              perceiveBehaviour(
                tuning,
                {
                  ...(kinds.traversal[index] ? traversalGeometry(object) : geometry),
                  ...(object.behaviour.pursuit && {
                    groundMap: () => pursuitGroundMap(area, object, false),
                  }),
                  decisions: namedStreams(
                    zone.seed + zone.attempt,
                    `idle-roam:${zone.area}:${index}`,
                  ),
                },
                zone.bird,
              ),
              object,
              seconds,
              before,
              zone.behaviours[index] ?? startBehaviour(tuning, object, zone.bird),
            )
          : undefined;
      const path = pathAt(object, zone.tracks[index] as Track, time);
      const after = behaviour?.at ?? objectStep(tuning, object, seconds, path, zone.bird, before);
      return { after: rectAt(object, after), before: rectAt(object, before), behaviour, object };
    })();
    resolving[index] = 0;
    frames[index] = frame;
    return frame;
  };
  const objects = area.objects.map((_, index) => resolveFrame(index));
  let escapes = objects.flatMap((frame, index) =>
    frame.behaviour?.escaped ? [{ bark: frame.behaviour.escaped, index }] : [],
  );
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
  const platforms = presentPlatforms.map((index) => objects[index]!);
  const fixedSolids =
    terrain === area.solids &&
    kinds.fixedSolids &&
    kinds.solids.every((index) => objects[index] === kinds.fixed[index] && present(index));
  const solids = fixedSolids
    ? kinds.fixedSolids!
    : [...terrain, ...kinds.solids.filter(present).map((index) => objects[index]!.after)];
  const preparedBird = preparePlatformBird(tuning, terrain, solids, platforms, zone.bird);
  let bird = preparedBird.bird;
  const crushed = preparedBird.crushed;
  const hazardIndices = kinds.hazards.filter((index) => {
    const { behaviour, object } = objects[index]!;
    return !object.contact && effectiveCollision(object, behaviour?.state) === "hazard";
  });
  const hazards = hazardIndices.map((index) => {
    const { after, behaviour, object } = objects[index]!;
    return (
      (effectiveHazardPhase(object, behaviour?.state) !== undefined
        ? timedHazardRect(object, after)
        : undefined) ??
      (objects[index] === kinds.fixed[index] ? kinds.fixedHazards[index] : undefined) ??
      (behaviour
        ? contactBox(object, after, behaviour.state.facing, behaviour.state.axis)
        : object.hitbox
          ? { ...object.hitbox, x: after.x + object.hitbox.x, y: after.y + object.hitbox.y }
          : after)
    );
  });
  // A boss on a red hazard or below the level dies as Chibi does; its pursuit ends without an
  // escape, and it stays dead for the rest of the attempt.
  const deaths = kinds.behaviours.filter((index) => {
    const state = behaviours[index];
    return (
      state !== undefined &&
      bossDeath(
        area,
        hazards.filter((_, at) => hazardIndices[at] !== index),
        area.objects[index]!,
        positions[index]!,
        state,
      ) !== undefined
    );
  });
  let defeated = zone.defeated;
  if (deaths.length > 0) {
    behaviours = behaviours.map((state, index) =>
      state && deaths.includes(index) ? defeatBoss(state) : state,
    );
    escapes = escapes.filter(({ index }) => !deaths.includes(index));
    defeated = { ...defeated, [zone.area]: [...(defeated?.[zone.area] ?? []), ...deaths] };
  }
  const fixedLedges =
    kinds.fixedLedges &&
    kinds.ledges.every((index) => objects[index] === kinds.fixed[index] && present(index));
  const ledges = fixedLedges
    ? kinds.fixedLedges!
    : kinds.ledges.filter(present).map((index) => objects[index]!.after);
  const pulses: ZonePulse[] = [...zone.pulses];
  let nextPulseId = zone.nextPulseId;
  const spawns: SpawnEvent[] = [];
  objects.forEach(({ behaviour, object }, emitter) => {
    for (const event of behaviour?.actions ?? []) {
      const effect = behaviourEffect({ emitter, object }, event);
      if (effect.kind === "pulse") {
        pulses.push({ id: nextPulseId++, ...effect.pulse });
      } else {
        spawns.push(effect.spawn);
      }
    }
  });
  const push = forcePulseVelocity(solids, seconds, pulses, birdBox(tuning, bird));
  const usePressed = input.useHeld && !zone.useHeld;
  const door = usePressed
    ? doorAt(tuning, layout.birdFrame, area.objects, positions, bird)
    : undefined;
  const playerInput = { ...input, dashPressed: usePressed && door === undefined, push };
  const dashing =
    (bird.dash?.remainingSeconds ?? 0) > EDGE || startsDash(tuning, playerInput, bird);
  const stepped = stepBirdWithSupport(tuning, solids, ledges, seconds, playerInput, bird);
  bird = stepped.bird;
  // The solver's actual collider reference names its owner; equal geometry never does.
  const birdSupport =
    stepped.support &&
    (area.crumbling?.some(({ supportId }) => supportId === stepped.support)
      ? stepped.support
      : area.objects[
          kinds.crumblingObjects.find((index) => objects[index]!.after === stepped.support) ?? -1
        ]);
  const remainingPulses = pulses.flatMap((pulse) => {
    const remaining = pulse.remaining - Math.max(0, seconds - pulse.start);
    return remaining > 0 ? [{ ...pulse, remaining, start: 0 }] : [];
  });
  const transientStep = stepTransients(
    { height: area.height, width: area.width, x: 0, y: 0 },
    solids,
    // Transients pass through path ledges and never come to rest on one.
    kinds.pathLedges.length > 0
      ? kinds.ledges
          .filter((index) => present(index) && !kinds.pathLedges.includes(index))
          .map((index) => objects[index]!.after)
      : ledges,
    seconds,
    birdBox(tuning, zone.bird),
    birdBox(tuning, bird),
    spawns,
    zone.transients,
    zone.nextTransientId,
  );
  bird = finishPlatformBird(seconds, preparedBird, bird);
  const crumblingAfter =
    crumbling &&
    endCrumblingFrame(
      area.crumbling!,
      {
        ...crumblingActors(
          tuning,
          area,
          bodies,
          birdSupport,
          positions,
          transientStep.entities,
          bird,
        ),
        timeSeconds: time,
      },
      crumbling,
    );
  const box = birdBox(tuning, bird);
  const beforeBox = birdBox(tuning, zone.bird);
  const birdAt = (time: number): Rect => ({
    ...beforeBox,
    x: beforeBox.x + ((box.x - beforeBox.x) * time) / seconds,
    y: beforeBox.y + ((box.y - beforeBox.y) * time) / seconds,
  });
  const swept =
    seconds > 0
      ? kinds.hazards.find((index) => {
          const { behaviour, object, orbitLegs } = objects[index]!;
          if (behaviour?.state.defeat) {
            return false;
          }
          if (object.orbit && orbitLegs) {
            const host = area.objects[object.orbit.host]!;
            return orbitLegs.some((leg) =>
              orbitSweptContact(
                object,
                host,
                leg,
                birdAt(leg.start - zone.seconds),
                birdAt(leg.end - zone.seconds),
              ),
            );
          }
          if (!behaviour && dashing) {
            const { after, before } = objects[index]!;
            return sweptContact(
              contactBox(object, before, 1),
              contactBox(object, after, 1),
              beforeBox,
              box,
            );
          }
          return behaviour?.segments.some((segment) => {
            if (segment.hazardPhase !== undefined) {
              return (
                segment.hazardPhase === "active" &&
                sweptContact(
                  timedHazardRect(object, segment.from),
                  timedHazardRect(object, segment.to),
                  birdAt(segment.start),
                  birdAt(segment.end),
                )
              );
            }
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
    if (!object.contact || behaviour?.state.defeat) {
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
  const overlap = hazards.findIndex((hazard) => rectsOverlap(box, hazard));
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
      ...(defeated && { defeated }),
      ...(forcedTransit && { forcedTransit }),
      behaviours,
      bird,
      crumbling: crumblingAfter,
      nextPulseId,
      nextTransientId: transientStep.nextId,
      objects: positions,
      pulses: remainingPulses,
      sceneryPlayback,
      seconds: time,
      steps,
      transients: transientStep.entities,
      useHeld: input.useHeld,
    };
    return {
      escapes,
      geometry,
      zone: {
        ...frozen,
        death: {
          ...(contact && { contact }),
          position: { x: bird.x, y: bird.y },
          reason: crushed ? "crush" : bird.y > area.height ? "fall" : "hazard",
          support: deathSupport(tuning, layout, frozen, bird),
          velocity: { x: bird.vx, y: bird.vy },
        },
      },
    };
  }
  const carrier = bird.grounded
    ? presentPlatforms.find((index) => standsOn(tuning, bird, objects[index]!.after))
    : undefined;
  const forcedTransitForecast =
    carrier !== undefined && area.objects[carrier]!.forcedTransit && seconds === STEP_SECONDS
      ? forecastForcedTransit(
          { area: zone.area, attempt: zone.attempt, dtSeconds: seconds, seconds: time },
          traversalGeometry(area.objects[carrier]!).traversalFrame?.sample,
          {
            bird,
            skillProfiles,
            terrainSolids: terrain,
            tuning,
            unknownPush: remainingPulses.length > 0,
          },
          {
            index: carrier,
            owner: area.objects[carrier]!,
            rect: objects[carrier]!.after,
            state: behaviours[carrier],
            track: zone.tracks[carrier]!,
          },
        )
      : undefined;
  return {
    escapes,
    geometry,
    zone: {
      ...zone,
      ...(defeated && { defeated }),
      ...(forcedTransit && { forcedTransit }),
      behaviours,
      bird,
      crumbling: crumblingAfter,
      door,
      forcedTransitForecast,
      nextPulseId,
      nextTransientId: transientStep.nextId,
      objects: positions,
      pulses: remainingPulses,
      sceneryPlayback,
      seconds: time,
      steps,
      transients: transientStep.entities,
      useHeld: input.useHeld,
    },
  };
}

// One fixed step of the zone. Pure, so the game and a headless simulator run the same rules.
// Solid objects block like terrain and ledge objects only from above; standing on a moving one,
// he moves with it, and leaving it by a jump or a walk off its edge he keeps its speed along x
// until he lands. A solid one running into his side pushes him ahead of it. Touching a hazard,
// being pushed into a solid or falling out of the area freezes a death snapshot until an
// explicit retry starts the next attempt. His box reaching the last column clears the zone, and
// reaching back into its first column ends it uncleared (turnedBack).
// Use with his drawn frame over a door sets `door` (doorAt), and the zone holds still until
// leaveRoom.
// skillProfiles holds the bird tuning under each skill selection (SKILL_PROFILES in progress);
// only a tuning among them admits ordinary forced-transit control.
export function stepZone(
  skillProfiles: readonly BirdTuning[],
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
  const kinds = areaObjects(area);
  const body = stepZoneBodies(skillProfiles, tuning, layout, seconds, input, zone);
  const { geometry } = body;
  const barks: ZoneBark[] = [];
  const seen = new Set(zone.spotted[zone.area] ?? []);
  kinds.spotted.forEach((index) => {
    const object = area.objects[index]!;
    const bark = object.behaviour?.spotted;
    const state = zone.behaviours[index];
    if (
      bark &&
      state?.active &&
      !state.defeat &&
      !seen.has(index) &&
      targetVisible(
        geometry,
        object,
        contactBox(object, zone.objects[index] ?? object.origin, state.facing, state.axis),
        birdBox(tuning, zone.bird),
      )
    ) {
      seen.add(index);
      barks.push({
        ...bark,
        owner: { area: zone.area, attempt: zone.attempt, objectIndex: index },
      });
    }
  });
  const spotted = barks.length ? { ...zone.spotted, [zone.area]: [...seen] } : zone.spotted;
  const ownerOf = (objectIndex: number) => ({
    area: zone.area,
    attempt: zone.attempt,
    objectIndex,
  });
  for (const { bark, index } of body.escapes) {
    barks.push({ ...bark, owner: ownerOf(index) });
  }
  // An escape on a death step does not count.
  if (body.zone.death) {
    return { ...body.zone, barks, escapes: [], spotted };
  }
  const escapes: ZoneEscape[] = body.escapes.map(({ index }) => ({
    cause: "distance",
    owner: ownerOf(index),
  }));
  const { bird, steps } = body.zone;
  const box = birdBox(tuning, bird);
  const atStageExit =
    layout.stageExit !== undefined &&
    layout.stageExit.area === zone.area &&
    rectsOverlap(box, layout.stageExit.rect);
  const link = atStageExit
    ? undefined
    : box.x < area.backX
      ? area.walkLinks?.left
      : box.x + box.width > area.exitX
        ? area.walkLinks?.right
        : undefined;
  if (link) {
    const arrival = enterArea(tuning, layout, link, {
      attempt: zone.attempt,
      ...(body.zone.defeated && { defeated: body.zone.defeated }),
      restarts: zone.restarts,
      seed: zone.seed,
      spotted,
      steps,
    });
    return {
      ...arrival,
      barks,
      bird: {
        ...arrival.bird,
        airJumpUsed: bird.airJumpUsed,
        dash: bird.dash,
        facing: bird.facing,
        jumpHeld: input.jumpHeld,
      },
      escapes,
    };
  }
  const door = atStageExit ? undefined : body.zone.door;
  // Entering a room door ends every engaged pursuit in the area as an escape, without a bark.
  const behaviours =
    door === undefined
      ? body.zone.behaviours
      : body.zone.behaviours.map((state, index) => {
          if (state?.pursuit?.phase !== "engaged") {
            return state;
          }
          escapes.push({ cause: "door", owner: ownerOf(index) });
          return {
            ...state,
            pursuit: { ...state.pursuit, phase: "escaped" as const, settled: false },
          };
        });
  return {
    ...body.zone,
    barks,
    behaviours,
    cleared: layout.stageExit ? atStageExit : box.x + box.width > area.exitX,
    door,
    escapes,
    spotted,
    turnedBack: !atStageExit && box.x < area.backX,
  };
}
