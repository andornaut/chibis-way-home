import { MAP_LAYOUT } from "../../data/layout.ts";
import type { Point, Rect, Size } from "../../data/types/index.ts";
import { FONT_SCALE } from "./fontRoles.ts";
import { hitAround } from "./hitAreas.ts";
import { PAGE_TITLE } from "./pageTitle.ts";

// How a path is inked: squares width wide stamped every step px along it, solid, dashed (on and
// off count the stamps' centres, in px), or as dots, one at each end and the rest spaced evenly,
// about every px apart.
export type PathStroke =
  | { readonly kind: "dashes"; readonly off: number; readonly on: number; readonly width: number }
  | { readonly kind: "dots"; readonly every: number; readonly width: number }
  | { readonly kind: "solid"; readonly width: number };

// Art's paper map (art/README.md, Map), in base pixels (MAP_LAYOUT). Offsets are from a node's
// centre. The paper fills the screen; each marker's centre pixel sits on its node's
// centre; a zone's icon sits centred over its marker; the bird stands on the current marker's
// ring. Back to title and Continue share standard-height footer buttons, secondary left and
// primary right. Labels use shared placement and press displacement without play marks; each
// press area grows by hitAreas.ts's rule. A tap on a zone marker lands within nodeHit, the zone
// marker's frame (ZONE_MARKER square) grown the same way.
const ZONE_MARKER = MAP_LAYOUT.zoneMarker;
const NODE_HIT = hitAround({
  height: ZONE_MARKER,
  width: ZONE_MARKER,
  x: 0,
  y: 0,
});

export const MAP_SCREEN = {
  actionY: MAP_LAYOUT.actionY,
  bird: MAP_LAYOUT.bird,
  icon: MAP_LAYOUT.icon,
  marker: MAP_LAYOUT.marker,
  nodeHit: { height: NODE_HIT.height, width: NODE_HIT.width } satisfies Size,
  paper: MAP_LAYOUT.paper,
  textScale: FONT_SCALE,
  title: PAGE_TITLE,
} as const;

// Each look a path takes, in a palette colour: unbuilt, built but not yet opened (locked, dimmed a
// step toward the paper), and opened by the zones he has completed (openMap).
export const MAP_PATH_LOOKS = {
  built: { colour: "slate", stroke: { kind: "dashes", off: 4, on: 6, width: 2 } },
  open: { colour: "dslate", stroke: { kind: "solid", width: 4 } },
  unbuilt: { colour: "slate", stroke: { every: 6, kind: "dots", width: 2 } },
} as const satisfies Record<string, { readonly colour: string; readonly stroke: PathStroke }>;

export type PathLook = keyof typeof MAP_PATH_LOOKS;

// Centre the actual glyph ink within the label background.
export function mapLabel(ink: Rect, centre: Point): { knockout: Rect; origin: Point } {
  const { label } = MAP_LAYOUT;
  const knockout = {
    height: label.height,
    width: label.width,
    x: centre.x - label.width / 2,
    y: centre.y + label.top,
  };
  return {
    knockout,
    origin: {
      x: centre.x - ink.width / 2 - ink.x,
      y: knockout.y + (knockout.height - ink.height) / 2 - ink.y,
    },
  };
}
