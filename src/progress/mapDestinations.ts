import { clampIndex } from "@andornaut/game-kit/arrays";

import type { MapDestination, ZoneMap } from "../data/types";
import { nodeOf, type OpenMap } from "./map";

export function destinationOf(map: ZoneMap, id: string): MapDestination {
  const destination = map.destinations.find((item) => item.id === id);
  if (!destination) {
    throw new Error(`No map destination ${id}`);
  }
  return destination;
}

export function destinationForStage(map: ZoneMap, stage: string): MapDestination {
  const destination = map.destinations.find((item) => item.stages.includes(stage));
  if (!destination) {
    throw new Error(`No map destination for stage ${stage}`);
  }
  return destination;
}

// Catalogue order determines the latest reached stage. Only actual plans on open graph nodes
// can be chosen; an unbuilt stage never becomes playable merely because its label is present.
export function destinationStages(
  plans: ReadonlySet<string>,
  map: ZoneMap,
  open: OpenMap,
  destination: MapDestination,
): readonly string[] {
  return destination.stages.filter((id) => {
    const node = nodeOf(map, id);
    return open.zones.includes(id) && node.zone !== undefined && plans.has(node.zone);
  });
}

type DestinationSelection =
  | { readonly kind: "unavailable" }
  | { readonly kind: "choose"; readonly latest: string; readonly stages: readonly string[] };

// Every available destination opens its picker; locked catalogue stages remain visible.
export function destinationSelection(
  plans: ReadonlySet<string>,
  map: ZoneMap,
  open: OpenMap,
  destination: MapDestination,
): DestinationSelection {
  const stages = destinationStages(plans, map, open, destination);
  const latest = stages.at(-1);
  return latest === undefined ? { kind: "unavailable" } : { kind: "choose", latest, stages };
}

export function steppedDestination(
  plans: ReadonlySet<string>,
  map: ZoneMap,
  open: OpenMap,
  stand: string,
  by: -1 | 1,
): string {
  const destinations = map.destinations.filter(
    (item) => destinationStages(plans, map, open, item).length > 0,
  );
  if (destinations.length === 0) {
    return destinationForStage(map, stand).id;
  }
  const current = destinations.findIndex((item) => item.stages.includes(stand));
  const at = clampIndex(destinations.length, current + by);
  return destinations[at]?.id ?? destinationForStage(map, stand).id;
}
