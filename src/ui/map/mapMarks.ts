import { clampIndex } from "@andornaut/game-kit/arrays";

import type { MapEdge, MapNode, Point, Size, ZoneMap } from "../../data/types";
import { nodeOf, type OpenMap } from "../../rules/map";
import type { PathLook } from "../layout/mapScreen";

export type MarkerState = "current" | "locked" | "normal" | "unbuilt" | "visited";

// A node's centre on the map, on its grid of tile px tiles.
export function nodeCentre(tile: number, node: MapNode): Point {
  return { x: node.at.col * tile + tile / 2, y: node.at.row * tile + tile / 2 };
}

// A node's marker: unbuilt where no built path touches it; else current where she stands,
// visited where she has completed its zone, locked on a zone node not open, and normal elsewhere.
export function markerState(
  map: ZoneMap,
  open: OpenMap,
  completed: ReadonlySet<string>,
  stand: string,
  node: MapNode,
): MarkerState {
  if (!map.edges.some((edge) => edge.built && (edge.from === node.id || edge.to === node.id))) {
    return "unbuilt";
  }
  if (node.id === stand) {
    return "current";
  }
  if (completed.has(node.id)) {
    return "visited";
  }
  return node.kind === "zone" && !open.zones.includes(node.id) ? "locked" : "normal";
}

// The open zone node a tap at point lands on: the one whose hit area, hit centred on the node,
// takes in the point, the nearest where they overlap. None for a tap on any other node.
export function zoneAtTap(
  tile: number,
  hit: Size,
  map: ZoneMap,
  open: OpenMap,
  point: Point,
): string | undefined {
  const picks = open.zones.flatMap((id) => {
    const centre = nodeCentre(tile, nodeOf(map, id));
    const dx = Math.abs(point.x - centre.x);
    const dy = Math.abs(point.y - centre.y);
    return dx <= hit.width / 2 && dy <= hit.height / 2
      ? [{ distance: Math.hypot(dx, dy), id }]
      : [];
  });
  picks.sort((a, b) => a.distance - b.distance);
  return picks[0]?.id;
}

// The open zone step places along the map's node order from stand (Left -1, Right 1), stopping
// at the first and the last.
export function steppedZone(open: OpenMap, stand: string, step: -1 | 1): string {
  if (open.zones.length === 0) {
    return stand;
  }
  const at = open.zones.indexOf(stand);
  const next = clampIndex(open.zones.length, at + step);
  return open.zones[next] ?? stand;
}

// A path's look: unbuilt, open where the zones she has completed open it, else built.
export function pathLook(open: OpenMap, edge: MapEdge): PathLook {
  if (!edge.built) {
    return "unbuilt";
  }
  return open.edges.includes(edge) ? "open" : "built";
}
