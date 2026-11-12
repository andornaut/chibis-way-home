// The map between stages.

import type { Point, TilePoint } from "./geometry.ts";

// A point on the map: a zone he plays, or a fork where paths split or join. at: where it is
// drawn on the map screen, on its tile grid. zone: a zone node's key in RECIPES; a zone
// not built yet has none.
export interface MapNode {
  readonly at: TilePoint;
  readonly id: string;
  readonly kind: "fork" | "zone";
  readonly zone?: string;
}

// A path from one node to the next, in the direction he travels, never back. A path not built
// yet is drawn dotted and cannot be chosen.
export interface MapEdge {
  readonly built: boolean;
  readonly from: string;
  readonly to: string;
}

// A pen mark on the map's paper: its art key and its top-left, in base pixels, at least a tile
// clear of every node, path and label.
interface MapDecoration {
  readonly art: string;
  readonly at: Point;
}

// A themed map destination groups a nonempty ordered sequence of stage-node ids.
// Its marker centre is on the map grid; icon is an art key with normal and visited tags.
export interface MapDestination {
  readonly at: TilePoint;
  readonly icon: string;
  readonly id: string;
  readonly stages: readonly [string, ...string[]];
}

// The map of zones: every path starts at start and ends at finish. decorations: the pen marks on
// its paper.
export interface ZoneMap {
  readonly decorations: readonly MapDecoration[];
  readonly destinations: readonly MapDestination[];
  readonly edges: readonly MapEdge[];
  readonly finish: string;
  readonly nodes: readonly MapNode[];
  readonly start: string;
}

// Where a stage's exit leads: the destination's next stage, the map (travelling on to the next
// destination when one direct built path leads there) or the final celebration.
export type StageCompletion =
  | { readonly kind: "next-stage"; readonly stage: string }
  | { readonly kind: "map"; readonly travelTo?: string }
  | { readonly kind: "celebration" };
