import type { ZoneMap } from "../data/types";
import { isLastZone, nodeOf, openMap, pathsFrom } from "./map";
import { destinationForStage } from "./mapDestinations";

export type StageCompletion =
  | { readonly kind: "next-stage"; readonly stage: string }
  | { readonly kind: "map"; readonly travelTo?: string }
  | { readonly kind: "celebration" };

// Replays follow the same catalogue transition as a first clear. Future forks remain a choice
// for a later route model, so automatic travel requires one direct built successor.
export function stageCompletion(
  map: ZoneMap,
  completedBefore: ReadonlySet<string>,
  stage: string,
): StageCompletion {
  const destination = destinationForStage(map, stage);
  const index = destination.stages.indexOf(stage);
  const open = openMap(map, new Set([...completedBefore, stage]));
  const nextStage = destination.stages[index + 1];
  if (nextStage !== undefined) {
    if (nodeOf(map, nextStage).zone === undefined || !open.zones.includes(nextStage)) {
      throw new Error(`Cannot advance to unavailable stage ${nextStage}`);
    }
    return { kind: "next-stage", stage: nextStage };
  }
  if (isLastZone(map, stage)) {
    return { kind: "celebration" };
  }
  const nextDestination = map.destinations[map.destinations.indexOf(destination) + 1];
  const travelTo = nextDestination?.stages[0];
  const paths = pathsFrom(map, stage).filter(
    ({ edge, node }) => edge.built && (node.kind === "fork" || node.zone !== undefined),
  );
  return travelTo !== undefined &&
    paths.length === 1 &&
    paths[0]?.node.id === travelTo &&
    open.zones.includes(travelTo)
    ? { kind: "map", travelTo }
    : { kind: "map" };
}
