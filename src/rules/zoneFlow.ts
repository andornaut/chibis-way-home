import type { ZoneDialoguePlan, ZoneMap } from "../data/types";
import { type StageCompletion, stageCompletion } from "./stageCompletion";

export interface ZoneStory extends ZoneDialoguePlan {
  readonly zone: string;
}
export type ZoneDepartureTarget = Exclude<StageCompletion, { readonly kind: "next-stage" }>;
export type ZoneExitFlow =
  | { readonly kind: "next-stage"; readonly stage: string }
  | { readonly kind: "departure"; readonly scene: string; readonly target: ZoneDepartureTarget };

export function zoneStoryForStage(
  map: ZoneMap,
  pairs: Readonly<Record<string, ZoneDialoguePlan>>,
  stage: string,
): ZoneStory | undefined {
  const destination = map.destinations.find((destination) => destination.stages.includes(stage));
  if (!destination) {
    return undefined;
  }
  const pair = pairs[destination.id];
  if (!pair) {
    throw new Error(`Missing zone dialogue pair ${destination.id}`);
  }
  return { ...pair, zone: destination.id };
}

export function zoneExitFlow(
  map: ZoneMap,
  story: ZoneStory,
  completed: ReadonlySet<string>,
  stage: string,
  turnedBack: boolean,
): ZoneExitFlow {
  const next: StageCompletion = turnedBack
    ? { kind: "map" }
    : stageCompletion(map, completed, stage);
  return next.kind === "next-stage"
    ? next
    : { kind: "departure", scene: story.outro, target: next };
}

export function foreshadowForRun(
  map: ZoneMap,
  stage: string,
  shown: boolean,
  story: ZoneStory | undefined,
): string | undefined {
  if (shown || !story) {
    return undefined;
  }
  const destination = map.destinations.find((destination) => destination.id === story.zone);
  return destination?.stages[0] === stage ? story.foreshadow : undefined;
}
