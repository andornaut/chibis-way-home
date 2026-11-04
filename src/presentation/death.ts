import { fillNames } from "@andornaut/game-kit/lines";
import { clamp, clamp01 } from "@andornaut/game-kit/numbers";

import type {
  DeathText,
  DeathTuning,
  GameText,
  Point,
  Rect,
  Size,
  ZoneDeath,
  ZoneMap,
} from "../data/types";
import { destinationForStage } from "../progress";

export type DeathPhase = "bounce" | "fall" | "impact" | "recoil" | "seated";
export interface DeathPresentation {
  readonly elapsed: number;
  readonly facing: -1 | 1;
  readonly floor: number;
  readonly phase: DeathPhase;
  readonly position: Point;
  readonly speedY: number;
}
export interface DeathView {
  readonly body: Size;
  readonly bounds: Rect;
  readonly frame: Size;
}

function visiblePosition(view: DeathView, at: Point): Point {
  const side = (view.frame.width - view.body.width) / 2;
  const top = view.frame.height - view.body.height;
  return {
    x: Math.max(
      view.bounds.x + side,
      Math.min(view.bounds.x + view.bounds.width - view.body.width - side, at.x),
    ),
    y: Math.max(view.bounds.y + top, at.y),
  };
}

// Resolve the frozen landing before framing the camera; the animation never changes its floor.
export function deathPresentationTarget(
  tuning: DeathTuning,
  body: Size,
  supportAt: (position: Point) => Rect | undefined,
  facing: -1 | 1,
  death: ZoneDeath,
): Point {
  const seconds = death.reason === "fall" ? 0 : tuning.recoilSeconds;
  const position = {
    x: death.position.x + tuning.recoilVelocity.x * facing * seconds,
    y: death.position.y + tuning.recoilVelocity.y * seconds,
  };
  const support = supportAt(position) ?? death.support;
  return {
    x: position.x,
    y: (support?.y ?? death.position.y + body.height) - body.height,
  };
}

// A void death is shown within the frozen viewport, with room for the configured visible fall.
export function startDeathPresentation(
  tuning: DeathTuning,
  view: DeathView,
  facing: -1 | 1,
  death: ZoneDeath,
): DeathPresentation {
  const bottom = view.bounds.y + view.bounds.height - tuning.cameraPan.bottomInset;
  const fallback = death.reason === "fall";
  return {
    elapsed: 0,
    facing,
    floor: bottom,
    phase: fallback ? "fall" : "recoil",
    position: visiblePosition(view, {
      x: death.position.x,
      y: fallback ? bottom - view.body.height - tuning.voidFallDistance : death.position.y,
    }),
    speedY: clamp(0, tuning.maxFallSpeed, death.velocity.y),
  };
}

// Only the dying bird moves toward its resolved frozen floor; the world never advances here.
export function stepDeathPresentation(
  tuning: DeathTuning,
  view: DeathView,
  seconds: number,
  pose: DeathPresentation,
): DeathPresentation {
  if (pose.phase === "seated") {
    return pose;
  }
  const elapsed = pose.elapsed + seconds;
  if (pose.phase === "recoil") {
    const move = clamp(0, seconds, tuning.recoilSeconds - pose.elapsed);
    const position = visiblePosition(view, {
      x: pose.position.x + tuning.recoilVelocity.x * pose.facing * move,
      y: pose.position.y + tuning.recoilVelocity.y * move,
    });
    return {
      ...pose,
      elapsed: elapsed >= tuning.recoilSeconds ? 0 : elapsed,
      phase: elapsed >= tuning.recoilSeconds ? "fall" : "recoil",
      position,
    };
  }
  if (pose.phase === "impact") {
    return elapsed < tuning.impactSeconds
      ? { ...pose, elapsed }
      : { ...pose, elapsed: 0, phase: "bounce", speedY: -tuning.bounceSpeed };
  }
  const floor = pose.floor;
  const speedY = Math.min(tuning.maxFallSpeed, pose.speedY + tuning.fallGravity * seconds);
  const position = { ...pose.position, y: pose.position.y + speedY * seconds };
  if (speedY >= 0 && position.y + view.body.height >= floor) {
    return {
      ...pose,
      elapsed: 0,
      floor,
      phase: pose.phase === "bounce" ? "seated" : "impact",
      position: { ...position, y: floor - view.body.height },
      speedY: 0,
    };
  }
  return { ...pose, elapsed, floor, position, speedY };
}

// Art's four death frames are recoil, fall, impact squash and seated; the bounce uses seated.
export function deathFrameIndex(phase: DeathPhase): number {
  return { bounce: 3, fall: 1, impact: 2, recoil: 0, seated: 3 }[phase];
}

export interface DeathSummary {
  readonly activeSeconds: number;
  readonly percent: number;
  readonly stageLabel: string;
  readonly stageNumber: string;
  readonly zoneLabel: string;
}

export function deathLabels(
  map: ZoneMap,
  words: GameText["map"],
  fallback: string,
  stageId: string,
): Pick<DeathSummary, "stageLabel" | "stageNumber" | "zoneLabel"> {
  const destination = map.nodes.some(({ id, kind }) => id === stageId && kind === "zone")
    ? destinationForStage(map, stageId)
    : undefined;
  return {
    stageLabel: words.stages[stageId] ?? fallback,
    stageNumber:
      destination === undefined ? fallback : String(destination.stages.indexOf(stageId) + 1),
    zoneLabel: destination === undefined ? fallback : (words.zones[destination.id] ?? fallback),
  };
}

// Timers retain full precision in storage; the card displays complete minutes and seconds.
export function deathSummary(words: DeathText, summary: DeathSummary) {
  const seconds = Math.max(0, Math.floor(summary.activeSeconds));
  const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  return {
    progress: fillNames(words.progress, {
      percent: String(Math.round(clamp01(summary.percent) * 100)),
    }),
    stage: fillNames(words.stage, { name: summary.stageLabel, number: summary.stageNumber }),
    time: fillNames(words.time, { time }),
    title: fillNames(words.title, { zone: summary.zoneLabel }),
  };
}
