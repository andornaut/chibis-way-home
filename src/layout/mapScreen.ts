import { SCREEN } from "../data/screen";
import type { MapNode, Point, Rect, Size } from "../data/types";
import type { PathStroke } from "../view/mapPath";
import { TEXT_BUTTON } from "./buttonLabel";
import { hitAround } from "./hitAreas";
import { labelledButton } from "./restartCard";

// Art's paper map (art/README.md, Map), in base pixels. Offsets marked "from the centre" are from
// a node's centre. The paper fills the screen; each marker's centre pixel sits on its node's
// centre; a zone's icon sits centred over its marker; the bird stands on the current marker's
// ring. Back to title and Continue share standard-height footer buttons, secondary left and
// primary right. Labels use shared placement and press displacement without play marks; each
// press area grows by hitAreas.ts's rule. A tap on a zone marker lands within nodeHit, the zone
// marker's frame (ZONE_MARKER square) grown the same way.
export const MAP_LABEL_WIDTH = 212;
export const MAP_LABEL_PADDING = 2;
const ACTION_WIDTH = 192;
const ACTION_Y = 300;
const actionButton = (x: number) =>
  labelledButton({ height: TEXT_BUTTON.height, width: ACTION_WIDTH, x, y: ACTION_Y });
const ZONE_MARKER = 35;
const NODE_HIT = hitAround({
  height: ZONE_MARKER,
  width: ZONE_MARKER,
  x: 0,
  y: 0,
});

export const MAP_SCREEN = {
  bird: {
    fork: { x: -13, y: -36 } satisfies Point,
    zone: { x: -13, y: -39 } satisfies Point,
  },
  continue: actionButton(SCREEN.width / 2 + TEXT_BUTTON.gap / 2),
  home: actionButton(SCREEN.width / 2 - ACTION_WIDTH - TEXT_BUTTON.gap / 2),
  icon: { x: -7, y: -7 } satisfies Point,
  marker: {
    fork: { x: -14, y: -14 } satisfies Point,
    zone: { x: -17, y: -17 } satisfies Point,
  },
  nodeHit: { height: NODE_HIT.height, width: NODE_HIT.width } satisfies Size,
  paper: { height: 360, width: 720, x: 0, y: 0 } satisfies Rect,
  textScale: 2,
  title: { x: 24, y: 16 } satisfies Point,
} as const;

// How paths are drawn: each bent by bend times its length, stamped every step px, and stopped
// trim px from the centre of the node at each end, by the node's kind.
export const MAP_PATH = {
  bend: 0.08,
  step: 0.5,
  trim: { fork: 11, zone: 15 } satisfies Record<MapNode["kind"], number>,
} as const;

// Each look a path takes, in a palette colour: unbuilt, built but not yet opened (locked, dimmed a
// step toward the paper), and opened by the zones she has completed (openMap).
export const MAP_PATH_LOOKS = {
  built: { colour: "slate", stroke: { kind: "dashes", off: 4, on: 6, width: 2 } },
  open: { colour: "dslate", stroke: { kind: "solid", width: 4 } },
  unbuilt: { colour: "slate", stroke: { every: 6, kind: "dots", width: 2 } },
} as const satisfies Record<string, { readonly colour: string; readonly stroke: PathStroke }>;

export type PathLook = keyof typeof MAP_PATH_LOOKS;

// A zone's name under its marker, from the name's advance width at the text scale: its text's
// origin, and the cream knock-out drawn under it, over the paths.
export function mapLabel(advance: number, centre: Point): { knockout: Rect; origin: Point } {
  const origin = { x: centre.x - Math.floor((advance - 4) / 2) - 2, y: centre.y + 12 };
  return {
    knockout: {
      height: 16,
      width: MAP_LABEL_WIDTH,
      x: centre.x - MAP_LABEL_WIDTH / 2,
      y: centre.y + 17,
    },
    origin,
  };
}
