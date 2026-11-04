import type { ForcedTransitLayout, Point, Rect, TargetedAttackWindow } from "../data/types";
import { EDGE } from "./bird";

export interface ForcedTransitBankContact {
  readonly group: string;
  readonly id: string;
}

export interface ForcedTransitEpisode {
  readonly boardingBank?: string;
  readonly group: string;
  readonly leg: string;
  readonly phase: "boarding" | "forced" | "spent";
  readonly supportIndex: number;
}

// attackWindow is the last certified admission; evidence says whether this step certified it.
export interface ForcedTransitState {
  readonly attackWindow: TargetedAttackWindow;
  // Banks touched on the most recent safe ground. They only admit boarding.
  readonly boardingAdmissions?: readonly ForcedTransitBankContact[];
  readonly episode?: ForcedTransitEpisode;
  readonly evidence: "certified" | "unknown";
}

// Support and bank contact are observations from the actual collision/carry adapter.
export interface ForcedTransitObservation {
  readonly bankAdmissions: readonly ForcedTransitBankContact[];
  readonly grounded: boolean;
  readonly ordinaryControl: boolean;
  readonly riderBodyOrigin: Point;
  // Grounded contact with terrain or a support that is not a forced-transit ride.
  readonly safeGround: boolean;
  readonly support?: {
    readonly index: number;
    readonly ordinaryJumpApexFeetY?: number | undefined;
    readonly ordinaryTakeoffOrigin?: Point | undefined;
    readonly origin: Point;
    readonly transit?: ForcedTransitLayout;
  };
}

function contains(interval: readonly [number, number], value: number): boolean {
  return value >= interval[0] - EDGE && value <= interval[1] + EDGE;
}

// Every authored bank the grounded feet touch, once per group and bank id.
export function forcedTransitBankAdmissions(
  transits: readonly ForcedTransitLayout[],
  feet: Rect,
): readonly ForcedTransitBankContact[] {
  const bottom = feet.y + feet.height;
  const admissions: ForcedTransitBankContact[] = [];
  for (const transit of transits) {
    for (const bank of transit.banks) {
      if (
        Math.abs(bottom - bank.y) < EDGE &&
        feet.x < bank.x + bank.width &&
        feet.x + feet.width > bank.x &&
        !admissions.some(({ group, id }) => group === transit.group && id === bank.id)
      ) {
        admissions.push({ group: transit.group, id: bank.id });
      }
    }
  }
  return admissions;
}

function snapshot(
  attackWindow: TargetedAttackWindow,
  episode: ForcedTransitEpisode | undefined,
  boardingAdmissions: readonly ForcedTransitBankContact[] | undefined,
): ForcedTransitState {
  return {
    attackWindow,
    ...(boardingAdmissions && boardingAdmissions.length > 0 && { boardingAdmissions }),
    ...(episode && { episode }),
    evidence: "certified",
  };
}

// Unknown ride state keeps the last certified admission.
function unknown(
  previous: ForcedTransitState | undefined,
  episode: ForcedTransitEpisode,
): ForcedTransitState {
  return {
    ...snapshot(previous?.attackWindow ?? "allowed", episode, previous?.boardingAdmissions),
    evidence: "unknown",
  };
}

export function stepForcedTransit(
  observation: ForcedTransitObservation,
  previous?: ForcedTransitState,
): ForcedTransitState {
  const support = observation.grounded ? observation.support : undefined;
  const transit = support?.transit;
  // Safe grounded contact ends the leg even while a ride still supports her; its banks become
  // the boarding admissions.
  if (observation.grounded && (observation.safeGround || !transit)) {
    return snapshot("allowed", undefined, observation.bankAdmissions);
  }
  const admissions = previous?.boardingAdmissions;
  let episode = previous?.episode;
  if (episode?.phase === "spent") {
    return snapshot("allowed", episode, admissions);
  }
  if (!transit || !support) {
    return episode ? unknown(previous, episode) : snapshot("allowed", undefined, admissions);
  }
  if (!episode) {
    const boardingBank = admissions?.find(
      ({ group, id }) => group === transit.group && transit.boardingBanks.includes(id),
    )?.id;
    episode = {
      ...(boardingBank && { boardingBank }),
      group: transit.group,
      leg: transit.leg,
      phase: "boarding",
      supportIndex: support.index,
    };
  }
  if (episode.group !== transit.group || episode.leg !== transit.leg) {
    return unknown(previous, episode);
  }
  const apexFeetY = support.ordinaryJumpApexFeetY;
  if (
    !observation.ordinaryControl ||
    !support.ordinaryTakeoffOrigin ||
    apexFeetY === undefined ||
    !Number.isFinite(apexFeetY)
  ) {
    return unknown(previous, episode);
  }
  const windows = transit.windows.filter(
    (window) =>
      window.certification === "ordinary" &&
      contains(window.supportOrigin.x, support.origin.x) &&
      contains(window.supportOrigin.y, support.origin.y) &&
      contains(window.riderOnSupport.x, observation.riderBodyOrigin.x - support.origin.x) &&
      contains(window.riderOnSupport.y, observation.riderBodyOrigin.y - support.origin.y),
  );
  const offered = windows.flatMap(({ result }) =>
    result.kind === "egress"
      ? transit.banks.filter(({ id, y }) => id === result.bankId && y >= apexFeetY)
      : [],
  );
  if (offered.some(({ purpose }) => purpose === "forward" || purpose === "refuge")) {
    return snapshot("allowed", { ...episode, phase: "spent" }, admissions);
  }
  if (
    episode.phase === "boarding" &&
    offered.some(({ id }) => transit.boardingBanks.includes(id))
  ) {
    return snapshot("allowed", episode, admissions);
  }
  if (episode.boardingBank && windows.some(({ result }) => result.kind === "forced")) {
    return snapshot("deferred", { ...episode, phase: "forced" }, admissions);
  }
  return unknown(previous, episode);
}
