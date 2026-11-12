import type { StageCompletion, ZoneDialoguePlan, ZoneMap } from "../data/types/index.ts";

export interface ZoneStory extends ZoneDialoguePlan {
  readonly zone: string;
}
export type ZoneDepartureTarget = Exclude<StageCompletion, { readonly kind: "next-stage" }>;
type ZoneExitFlow =
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
  if (pair.introStage !== undefined && !destination.stages.includes(pair.introStage)) {
    throw new Error(
      `Introduction stage ${pair.introStage} is outside destination ${destination.id}`,
    );
  }
  return { ...pair, zone: destination.id };
}

// The stage exit's flow: straight into the next stage, or through the destination's outro.
export function zoneExitFlow(next: StageCompletion, story: ZoneStory): ZoneExitFlow {
  return next.kind === "next-stage"
    ? next
    : { kind: "departure", scene: story.outro, target: next };
}

export function introductionForRun(
  map: ZoneMap,
  stage: string,
  seen: ReadonlySet<string>,
  story: ZoneStory | undefined,
): ZoneStory | undefined {
  if (!story || seen.has(story.zone)) {
    return undefined;
  }
  const destination = map.destinations.find((destination) => destination.id === story.zone);
  if (!destination || (story.introStage ?? destination.stages[0]) !== stage) {
    return undefined;
  }
  if (!story.entry) {
    throw new Error(`Missing entry introduction profile ${story.zone}`);
  }
  return story;
}
