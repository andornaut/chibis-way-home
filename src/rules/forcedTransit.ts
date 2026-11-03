import type { ForcedTransitLayout, Point, TargetedAttackWindow } from "../data/types";
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

export interface ForcedTransitState {
  readonly attackWindow: TargetedAttackWindow;
  readonly episode?: ForcedTransitEpisode;
  readonly lastBank?: ForcedTransitBankContact;
}

// Support and safe disembark are observations from the actual collision/carry adapter.
export interface ForcedTransitObservation {
  readonly bank?: ForcedTransitBankContact;
  readonly grounded: boolean;
  readonly riderBodyOrigin: Point;
  readonly safeDisembark?: boolean;
  readonly support?: {
    readonly index: number;
    readonly origin: Point;
    readonly transit?: ForcedTransitLayout;
  };
}

function contains(interval: readonly [number, number], value: number): boolean {
  return value >= interval[0] - EDGE && value <= interval[1] + EDGE;
}

function snapshot(
  attackWindow: TargetedAttackWindow,
  episode?: ForcedTransitEpisode,
  lastBank?: ForcedTransitBankContact,
): ForcedTransitState {
  return {
    attackWindow,
    ...(episode && { episode }),
    ...(lastBank && { lastBank }),
  };
}

export function stepForcedTransit(
  observation: ForcedTransitObservation,
  previous?: ForcedTransitState,
): ForcedTransitState {
  const support = observation.grounded ? observation.support : undefined;
  const transit = support?.transit;
  if (observation.grounded && !transit && observation.safeDisembark === true) {
    return snapshot("allowed", undefined, observation.bank);
  }
  const lastBank = observation.grounded && !support ? undefined : previous?.lastBank;
  let episode = previous?.episode;
  if (episode?.phase === "spent") {
    return snapshot("allowed", episode, lastBank);
  }
  if (!transit || !support) {
    return snapshot(episode ? "unknown" : "allowed", episode, lastBank);
  }
  if (!episode) {
    const boardingBank =
      lastBank?.group === transit.group && transit.boardingBanks.includes(lastBank.id)
        ? lastBank.id
        : undefined;
    episode = {
      ...(boardingBank && { boardingBank }),
      group: transit.group,
      leg: transit.leg,
      phase: "boarding",
      supportIndex: support.index,
    };
  }
  if (episode.group !== transit.group || episode.leg !== transit.leg) {
    return snapshot("unknown", episode, lastBank);
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
    result.kind === "egress" ? transit.banks.filter(({ id }) => id === result.bankId) : [],
  );
  if (offered.some(({ purpose }) => purpose === "forward" || purpose === "refuge")) {
    return snapshot("allowed", { ...episode, phase: "spent" }, lastBank);
  }
  if (
    episode.phase === "boarding" &&
    offered.some(({ id }) => transit.boardingBanks.includes(id))
  ) {
    return snapshot("allowed", episode, lastBank);
  }
  if (episode.boardingBank && windows.some(({ result }) => result.kind === "forced")) {
    return snapshot("deferred", { ...episode, phase: "forced" }, lastBank);
  }
  return snapshot("unknown", episode, lastBank);
}
