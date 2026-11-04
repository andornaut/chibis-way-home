import type { MapDestination, Point, Size, ZoneMap } from "../../data/types";
import { destinationStages, nodeOf, type OpenMap } from "../../progress";
import type { PathLook } from "../layout/mapScreen";

type MarkerState = "current" | "locked" | "normal" | "unbuilt" | "visited";

export function destinationCentre(tile: number, destination: MapDestination): Point {
  return { x: destination.at.col * tile + tile / 2, y: destination.at.row * tile + tile / 2 };
}

export function destinationState(
  plans: ReadonlySet<string>,
  map: ZoneMap,
  open: OpenMap,
  completed: ReadonlySet<string>,
  stand: string,
  destination: MapDestination,
): MarkerState {
  const built = destination.stages.some((id) => {
    const plan = nodeOf(map, id).zone;
    return plan !== undefined && plans.has(plan);
  });
  if (!built) {
    return "unbuilt";
  }
  const stages = destinationStages(plans, map, open, destination);
  if (stages.length === 0) {
    return "locked";
  }
  if (destination.stages.includes(stand)) {
    return "current";
  }
  return destination.stages.every((id) => completed.has(id)) ? "visited" : "normal";
}

export function destinationAtTap(
  tile: number,
  hit: Size,
  plans: ReadonlySet<string>,
  map: ZoneMap,
  open: OpenMap,
  point: Point,
): string | undefined {
  return map.destinations
    .filter((item) => destinationStages(plans, map, open, item).length > 0)
    .map((item) => ({ centre: destinationCentre(tile, item), id: item.id }))
    .filter(
      ({ centre }) =>
        Math.abs(centre.x - point.x) <= hit.width / 2 &&
        Math.abs(centre.y - point.y) <= hit.height / 2,
    )
    .sort(
      (a, b) =>
        Math.hypot(a.centre.x - point.x, a.centre.y - point.y) -
        Math.hypot(b.centre.x - point.x, b.centre.y - point.y),
    )[0]?.id;
}

export function destinationPathLook(
  plans: ReadonlySet<string>,
  map: ZoneMap,
  open: OpenMap,
  to: MapDestination,
): PathLook {
  if (destinationStages(plans, map, open, to).length > 0) {
    return "open";
  }
  return to.stages.some((id) => {
    const key = nodeOf(map, id).zone;
    return key !== undefined && plans.has(key);
  })
    ? "built"
    : "unbuilt";
}
