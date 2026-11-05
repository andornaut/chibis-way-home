/**
 * Zone 1 art: a New York street (downtown on a pale steel morning, two screens tall, climbed into
 * its upper screen) as a 12px tileset and modular backdrop pieces that the game places from level
 * data, plus the boutique lobby tileset. Nothing here is a fixed panorama.
 *
 * Usage, from the repository root:
 *   node art/tools/floor1.ts build            write public/art/tilesets/<key>.png + .json and
 *                                             public/art/backdrops/<key>.png, and list them in the
 *                                             manifest under "tilesets" and "backdrops"
 *   node art/tools/floor1.ts preview OUT.png  an example street column, 720x720 (two screens
 *                                             tall), beside both tilesets at 4x, composed from the
 *                                             pieces with the bird and the touch buttons
 *
 * Scale
 * - Outdoors the world is drawn as if zoomed out 4x while the bird and the 12px tiles keep their
 *   size: a storey is 180px and an ordinary room entrance is 84px, twice the bird's 42px frame
 *   height. The street is 720px (60 tiles) tall: the sidewalk's top is y 600 (row 50) with 10 rows
 *   of sidewalk and road below it, the ground storey runs from y 420 to it, and storeys stack every
 *   180px above (a two-storey brownstone's roof is at y 240, row 20). Indoors (the lobby) is a
 *   separate scene at full scale, also 720px tall, its floor at y 672.
 *
 * Palette (the street; the lobby keeps its own)
 * - A pale steel atmosphere: flat zone-blue sky, zone-blue-shade window-free distant skyline and
 *   sparse slate middle-distance buildings. The two city layers repeat at 720px and stay separate
 *   for parallax. Near facades and shopfronts use slate, dslate and grey, with quiet windows. Cream
 *   icons, ochre awnings and amber room doors provide warm accents.
 * - street-city-far: 720x600, bottom y 600, repeat x; suggested horizontal scroll factor 0.15.
 * - street-city-mid: 720x600, bottom y 600, repeat x; suggested horizontal scroll factor 0.4.
 * - street-sky stays fixed; near facades, storefronts, doors, ledges and attached props share
 *   gameplay motion.
 *
 * Tilesets
 * - A tileset is one PNG of 12x12 tiles in rows of COLUMNS (8), no spacing or margin, transparent
 *   where a tile has no art, and a JSON beside it:
 *     {"tileSize": 12, "columns": 8,
 *      "tiles": {"<name>": <index>, ...},             index = row * columns + column, every tile named
 *      "pieces": {"<name>": [[<index>, ...], ...]}}   multi-tile pieces as rows of indices, top row first
 *   Names are kebab-case. A tile whose name starts with "one-way-" is a one-way ledge: it stops a
 *   fall onto its top edge and nothing else. A tile whose name starts with "door-" or "exit-" is a
 *   doorway: it has no collision, and where the level gives it a room, the game puts a Use zone over
 *   its piece. A tile whose name starts with "pit-" is a pit: it has no collision, so she falls
 *   through it and out of the level. Every other tile with art is solid on all sides.
 * - The manifest lists each as {"key": "<key>", "png": "tilesets/<key>.png", "json":
 *   "tilesets/<key>.json"}.
 * - Walkable surfaces: the walkable edge is the tile's top row. A surface tile has a 1px edge, a
 *   2px light lip and a 2px darker underside; the face tiles below it are plainer and darker.
 *
 * tiles-street
 * - sidewalk-top, sidewalk-top-joint (a 2px slab joint at the right edge; alternate them, 24px
 *   rhythm), sidewalk-top-left, sidewalk-top-right (plain ends, over a drop), kerb-left, kerb-right
 *   (a pale stone kerb where the sidewalk meets a cross street, one tile above the road),
 *   sidewalk-face, sidewalk-face-left, sidewalk-face-right: pale concrete (white lip, lgrey slabs)
 *   over a slate face.
 * - road-top, road: asphalt, one tile below the sidewalk.
 * - one-way-awning-left, one-way-awning, one-way-awning-right: an ochre-and-cream shop awning seen
 *   front-on, 4px stripes and a scalloped hem, art in the top 11 rows. Lay them on row 20 (y 240),
 *   6 tiles above the sidewalk, across a shopfront under its sign.
 * - one-way-canopy-left, one-way-canopy, one-way-canopy-right: a dark-brown canopy with a white
 *   lip, the same shape, laid on row 20 over the hotel door.
 * - planter-top-left, planter-top, planter-top-right (a clipped hedge: the walkable top),
 *   planter-left, planter, planter-right (the box). A planter is 2 tiles tall: a 2-tile step.
 * - door (piece, 5x7 tiles, 60x84): a muted glazed leaf in complete grey jambs with a small amber
 *   handle, for a room entrance. Tiles door-0 to door-34 in row order; no collision. Existing
 *   non-door indices stay fixed.
 * - The cellar hatch, a hazard: an open pit in the sidewalk, any number of tiles wide, its two steel
 *   leaves standing up. On the sidewalk row: hatch-left, then pit-opening for each opening tile,
 *   then hatch-right. pit-opening fills every row below the opening to the level's bottom, and
 *   sidewalk-face-right and sidewalk-face-left run down under the two edges. pit-leaf-left-top over
 *   pit-leaf-left stand on the two rows above hatch-left, pit-leaf-right-top over pit-leaf-right
 *   above hatch-right. hatch-left and hatch-right are solid sidewalk ends capped by a steel angle
 *   iron; pit-opening is the dark drop (ink); the leaves are slate plates with dslate studs, 20px
 *   tall, leaning outwards, with no collision. Steel is the slate ramp (slate, dslate, navy), no
 *   grey. Tiles 35 to 41, after the door, so every earlier index holds.
 * - Crosswalk, tiles 65 to 73, after the door's later cells; the game looks tiles up by name. Drawn
 *   in their own colours, outside the cool tile map. A strip of crosswalk-<phase>-left, one
 *   crosswalk-<phase>-middle per inner cell and crosswalk-<phase>-right fills the row above the
 *   road top between two kerbs, its ends meeting the kerbs; the game swaps the strip's phase.
 *   crosswalk-walk-*: a dslate band with 6px lgrey zebra bars every 12px, rows 2 to 9, inset 3px
 *   from each tile edge, so any width repeats; no lip. crosswalk-warning-*: the walk tile with a
 *   4px amber border on the strip's outer edges (top and bottom on every tile, the left side on
 *   -left, the right side on -right). crosswalk-traffic-*: the whole cell bright red (#e43b44), no
 *   ink and no lip, the same fill as the procedural vent's active phase. They are the crosswalk
 *   timed hazard's phase skins, never placed as terrain; contact is the hazard's.
 *
 * crosswalk-signal (sprite, 12x84, bottom-centre on a 1x7 footprint standing on the kerb top; no
 * collision or hit box): an ink-outlined dslate signal head (rows 0 to 25) with a hand lens over a
 * walker lens, on a slate pole with an ink edge and a dslate foot. Tags, all looping (once []):
 * walk 1 frame (the white walking figure lit, the hand dark), warning 2 x 250ms (the amber hand lit,
 * then dark; the walker dark), stop 1 frame (the amber hand steady). Dark lenses show the unlit
 * glyph in navy on ink. Amber appears only on the hand.
 *
 * tiles-lobby (the boutique lobby at indoor scale; no current stage)
 * - Every walkable top, the floor and each one-way ledge, has the same 2px cream lip under a 1px
 *   plum edge, so the standable edges are the brightest lines in the room, in colour and in
 *   greyscale.
 * - floor-top, floor-top-joint (a 2px board end at the right edge; alternate them, 24px rhythm),
 *   floor-top-left, floor-top-right, floor-face, floor-face-left, floor-face-right: brown boards
 *   over a dark-brown face. The lobby floor line is y 672 (row 56) in a level 720px (60 tiles)
 *   tall.
 * - One-way ledges, each a 7px slab (left, middle, right): one-way-balcony-* (the mezzanine's front
 *   edge), one-way-shelf-* (bookcase boards, with brackets on the end tiles), one-way-cushion-* (the
 *   sofa's seat and back), one-way-desk-* (the reception desk's top).
 * - post-cap-left/right, post-left/right, post-base-left/right: a wood post 2 tiles wide, solid, for
 *   the room's ends.
 * - exit (piece, 7x15 tiles, 84x180, a door at indoor scale): a stairwell, an opening with stairs
 *   rising to the right under a white up-arrow on a green sign. Tiles exit-0 to exit-104 in row
 *   order; no collision.
 *
 * Backdrops
 * - One PNG per piece in public/art/backdrops/<key>.png, drawn behind the play layer, lower in
 *   contrast and saturation than the tiles. The manifest lists each as
 *     {"key": "<key>", "png": "backdrops/<key>.png", "width": w, "height": h,
 *      "anchor": "bottom-left", "y": y, "repeat": "x" | "none"}
 *   The piece's bottom-left corner sits at world y (its bottom edge), at an x the level data
 *   chooses. "repeat": "x" tiles it horizontally across a run; "none" places it once. Street y
 *   values are in the two-screen frame (the sidewalk's top at y 600, row 50); the sidewalk and road
 *   tiles fill rows 50 to 59 below it. Draw order, back to front: sky, city layers, facades and
 *   their rooflines, storefronts, street furniture, then the play layer.
 * - Sky and city (repeat x): street-sky 48x600 (y 600), flat zone-blue. street-city-far and
 *   street-city-mid are each 720x600 (y 600), window-free zone-blue-shade and slate silhouettes.
 * - Facades (repeat x, one per building type; a run per building): facade-one-storey 48x192 (y 600,
 *   a parapet 192 up), facade-brownstone 48x312 (y 600). The brownstone shows the 180px ground
 *   storey with a band over the shopfronts and the next storey's windows above, up to y 288.
 * - Roofline (repeat x): roofline-brownstone, 48x48, caps the brownstone facade (bottom at its top,
 *   y 288), so the roof is at y 240, row 20.
 * - Climbing (backdrop, no collision): fire-escape-railing 48x24 (repeat x, its bottom on a
 *   ledge's top).
 * - Storefronts (none), each 120 tall (y 600), a whole number of tiles wide, with a sign icon (never
 *   text), a tall display window and a 46px door: storefront-cafe 84, storefront-noodle-bar 120.
 * - Street furniture (none, y 600): walk-signal 12x82.
 */

import { readFileSync, writeFileSync } from "node:fs";

import { encodeRgbPng } from "@andornaut/art-kit/png";
import {
  composite,
  crop,
  filledImage,
  frameToRgba,
  opaque,
  paste,
  resizeNearest,
} from "@andornaut/art-kit/raster";
import type { RgbaImage } from "@andornaut/art-kit/rgbaImage";

import * as backgroundTones from "./backgroundTones.ts";
import { commands, run } from "./cli.ts";
import { frameImage, readImage, writeImage } from "./imageArt.ts";
import * as pixel from "./pixel.ts";
import { darker, Grid, rgb } from "./pixel.ts";
import * as roomDoors from "./roomDoors.ts";

type Colour = string | null;
type Rect = readonly [x: number, y: number, w: number, h: number, c: Colour];
type Tile = readonly [name: string, tile: Grid];
type Pieces = Record<string, string[][]>;

const USAGE = "Usage: floor1.ts build | preview OUT.png";
const T = 12;
const COLUMNS = 8;
const FY = 312; // the sidewalk line inside a one-screen street piece (facades, storefronts)
// The street's sidewalk top (row 50): the street is 720px (60 tiles) tall, ground below.
const STREET_FY = 600;
const BACKDROPS = "public/art/backdrops";
const SPRITES = "public/art/sprites";
const PNG_OPTIONS = { deflateLevel: 9, deflateStrategy: 3, filterType: -1 };

/** Fill rects [x, y, w, h, colour or null] on a Grid in order. */
function rects(g: Grid, ...list: readonly Rect[]): Grid {
  for (const [x, y, w, h, c] of list) {
    g.rect(x, y, w, h, c);
  }
  return g;
}

/**
 * Exposed ends of a solid tile: a 1px edge, a 2px lit band (left) or shade band (right) from row
 * `below`; a surface end drops its corner pixel.
 */
function ends(
  g: Grid,
  kind: string,
  edge: string,
  lit: string | null = null,
  shade: string | null = null,
  below = 0,
): Grid {
  if (kind.includes("l")) {
    rects(g, [0, 0, 1, T, edge]);
    if (lit) {
      rects(g, [1, below, 2, T - below, lit]);
    }
    if (kind.includes("t")) {
      g.p(0, 0, null);
    }
  }
  if (kind.includes("r")) {
    rects(g, [T - 1, 0, 1, T, edge]);
    if (shade) {
      rects(g, [T - 3, below, 2, T - below, shade]);
    }
    if (kind.includes("t")) {
      g.p(T - 1, 0, null);
    }
  }
  return g;
}

function surface(g: Grid, edge: string, lip: string, body: string, under: string): Grid {
  return rects(
    g,
    [0, 0, T, T, body],
    [0, 0, T, 1, edge],
    [0, 1, T, 2, lip],
    [0, T - 2, T, 2, under],
  );
}

// ---------------------------------------------------------------- the street's cool palette

// Zone 1 is a pale steel morning downtown. Its pieces are drawn with the warm ramp names in the
// functions below and recoloured at export through these maps, so their shapes, sizes and indices
// never depend on the palette. Colours a map does not name keep their own (the warm accents: cream
// sign icons, the amber door, red, pink).
type ColourMapping = Readonly<Record<string, string>>;
// Buildings, shopfronts and street furniture: muted blue-grey and slate.
const COOL_NEAR: ColourMapping = {
  dbrown: "slate",
  plum: "dslate",
  brown: "grey",
  rust: "slate",
  ochre: "grey",
  tan: "lgrey",
  ink: "navy",
  forest: "dslate",
  teal: "dslate",
  purple: "dslate",
  dgreen: "slate",
  green: "grey",
  sky: "lgrey",
  blue: "slate",
  skin2: "grey",
  skin1: "lgrey",
};
// Play tiles: white lips, a light concrete band over a soft slate fill.
const COOL_TILES: ColourMapping = {
  skin1: "white",
  skin2: "lgrey",
  cream: "white",
  tan: "lgrey",
  brown: "slate",
  dbrown: "navy",
  plum: "dslate",
};
const COOL_AWNING: ColourMapping = { dgreen: "ochre", forest: "dbrown" }; // ochre and cream
const COOL_CANOPY: ColourMapping = { tan: "white", forest: "dbrown" }; // dark brown, a white lip

/** A copy of a Grid with each colour in mapping (K names) replaced by its target. */
function recolour(g: Grid, mapping: ColourMapping): Grid {
  const table = new Map(Object.entries(mapping).map(([a, b]) => [pixel.hexc(a), pixel.hexc(b)]));
  const out = new Grid(g.w, g.h);
  out.px = g.px.map((row) => row.map((c) => (c ? (table.get(c) ?? c) : null)));
  return out;
}

function cool(fn: () => Grid, mapping: ColourMapping): () => Grid {
  return () => recolour(fn(), mapping);
}

// ---------------------------------------------------------------- street tiles

// Warm stone sidewalk, a cream stone kerb, a navy road; green-and-cream awnings; the hotel's
// forest-green canopy.
const S = {
  edge: "dbrown",
  lip: "skin1",
  body: "skin2",
  under: "brown",
  joint: "brown",
  face: "brown",
  faceLit: "skin2",
  faceSh: "dbrown",
  kerb: "cream",
  kerbLip: "white",
  kerbSh: "tan",
  road: "navy",
  roadLip: "dslate",
  box: "brown",
  boxLip: "tan",
  boxSh: "dbrown",
  boxEdge: "dbrown",
} as const;
interface AwningStyle {
  edge: string;
  lip: string;
  a: string;
  b: string;
}
const AWNING: AwningStyle = { edge: "forest", lip: "white", a: "dgreen", b: "cream" };
const CANOPY: AwningStyle = { edge: "ink", lip: "tan", a: "forest", b: "forest" };

function sidewalk(kind: string, joint = false): Grid {
  const g = new Grid(T, T);
  if (kind.includes("t")) {
    surface(g, S.edge, S.lip, S.body, S.under);
    if (joint) {
      rects(g, [T - 2, 3, 2, 7, S.joint]);
    }
    return ends(g, kind, S.edge, S.lip, S.under, 1);
  }
  rects(g, [0, 0, T, T, S.face]);
  return ends(g, kind, S.edge, S.faceLit, S.faceSh);
}

function kerb(side: string): Grid {
  const g = rects(
    new Grid(T, T),
    [0, 0, T, T, S.kerb],
    [0, 0, T, 1, S.edge],
    [0, 1, T, 2, S.kerbLip],
    [0, T - 2, T, 2, S.kerbSh],
  );
  ends(g, `t${side}`, S.edge, S.kerbLip, S.kerbSh, 1);
  if (side === "l") {
    g.p(1, 0, null);
    g.p(0, 1, null);
    g.p(1, 1, S.edge);
  } else {
    g.p(T - 2, 0, null);
    g.p(T - 1, 1, null);
    g.p(T - 2, 1, S.edge);
  }
  return g;
}

function road(top: boolean): Grid {
  const g = rects(new Grid(T, T), [0, 0, T, T, S.road]);
  if (top) {
    rects(g, [0, 0, T, 1, "ink"], [0, 1, T, 2, S.roadLip]);
  }
  return g;
}

/** A canvas awning seen front-on: a light lip, 4px stripes, a scalloped hem; art in the top 11 rows. */
function awning(kind: string, p: AwningStyle = AWNING): Grid {
  const g = rects(new Grid(T, T), [0, 0, T, 1, p.edge], [0, 1, T, 2, p.lip]);
  for (let x = 0; x < T; x += 4) {
    rects(g, [x, 3, 4, 5, Math.floor(x / 4) % 2 === 0 ? p.a : p.b]);
  }
  for (const x of [0, 6]) {
    rects(g, [x, 8, 6, 1, p.a], [x + 1, 9, 4, 1, p.a], [x + 2, 10, 2, 1, p.edge]);
    for (const [px, py] of [
      [x, 9],
      [x + 5, 9],
      [x + 1, 10],
      [x + 4, 10],
    ] as const) {
      g.p(px, py, p.edge);
    }
  }
  if (kind === "l") {
    rects(g, [0, 0, 1, 9, p.edge]);
    g.p(0, 0, null);
  }
  if (kind === "r") {
    rects(g, [T - 1, 0, 1, 9, p.edge]);
    g.p(T - 1, 0, null);
  }
  return g;
}

function planter(kind: string): Grid {
  const g = new Grid(T, T);
  if (kind.includes("t")) {
    rects(
      g,
      [0, 0, T, T, S.box],
      [0, 0, T, 1, "forest"],
      [0, 1, T, 2, "green"],
      [0, 3, T, 3, "dgreen"],
      [0, 6, T, 1, S.boxEdge],
      [0, 7, T, 2, S.boxLip],
    );
    if (kind.includes("l")) {
      rects(g, [0, 0, 1, T, S.boxEdge], [0, 0, 1, 6, "forest"]);
      g.p(0, 0, null);
      g.p(1, 0, null);
      g.p(1, 1, "forest");
    }
    if (kind.includes("r")) {
      rects(g, [T - 1, 0, 1, T, S.boxEdge], [T - 1, 0, 1, 6, "forest"], [T - 3, 9, 2, 3, S.boxSh]);
      g.p(T - 1, 0, null);
      g.p(T - 2, 0, null);
      g.p(T - 2, 1, "forest");
    }
    return g;
  }
  rects(g, [0, 0, T, T, S.box], [0, T - 1, T, 1, S.boxEdge]);
  return ends(g, kind, S.boxEdge, S.boxLip, S.boxSh);
}

/** Ordinary street room entrance, 60x84, with muted glazing and an amber handle. */
function hotelDoor(): Grid {
  return roomDoors.door();
}

// The cellar hatch: an open pit in the sidewalk with its two steel leaves standing up. Steel is the
// slate ramp (slate, dslate, navy): slate leaves read against the dark facades in greyscale, where
// dslate would not.
const LEAF_H = 20; // leaf height above the sidewalk, in px

/**
 * The sidewalk tile beside the opening (side "l" for the hatch's left edge, "r" its right): a
 * sidewalk end capped by a steel angle iron, its top lit, its flange running 5px down the shaft
 * wall. Solid.
 */
function hatchEdge(side: string): Grid {
  const g = sidewalk(side === "l" ? "tr" : "tl");
  const x = side === "l" ? T - 4 : 0;
  rects(g, [x, 0, 4, 3, "dslate"], [x, 0, 4, 1, "slate"]);
  const fx = side === "l" ? T - 2 : 0;
  rects(g, [fx, 3, 2, 5, "dslate"], [side === "l" ? T - 1 : 0, 3, 1, 5, "navy"]);
  return g;
}

/** The opening: the dark drop, ink to the bottom of the level. No collision. */
function pit(): Grid {
  return rects(new Grid(T, T), [0, 0, T, T, "ink"]);
}

/**
 * The left leaf, standing on the left edge and leaning out 1px every 6 rows: a slate plate with
 * dslate studs and a dslate hinge knuckle, ink-outlined, LEAF_H tall over 2 tile rows (24px) above
 * the sidewalk.
 */
function hatchLeaf(): Grid {
  const g = new Grid(T, 2 * T);
  for (let y = 2 * T - LEAF_H; y < 2 * T; y++) {
    const lean = Math.floor((2 * T - 1 - y) / 6);
    rects(g, [5 - lean, y, 6, 1, "slate"]);
  }
  for (let y = 2 * T - LEAF_H + 2; y < 2 * T - 1; y += 4) {
    const lean = Math.floor((2 * T - 1 - y) / 6);
    rects(g, [5 - lean + (Math.floor(y / 4) % 2 ? 1 : 3), y, 2, 2, "dslate"]);
  }
  rects(g, [9, 2 * T - 3, 2, 3, "dslate"]);
  g.px = g.outlined({ edge: () => pixel.hex("ink") });
  return g;
}

/** The leaf as its top and bottom tiles, mirrored for the right edge. */
function splitLeaf(side: string): [top: Grid, bottom: Grid] {
  const g = hatchLeaf();
  if (side === "r") {
    g.px = pixel.flipped(g.px);
  }
  const top = new Grid(T, T);
  const bottom = new Grid(T, T);
  top.px = g.px.slice(0, T);
  bottom.px = g.px.slice(T);
  return [top, bottom];
}

/** A multi-tile drawing as named 12x12 tiles (prefix-0, prefix-1, ... in row order) and its rows. */
function cut(g: Grid, prefix: string): [tiles: Tile[], rows: string[][]] {
  const tiles: Tile[] = [];
  const rows: string[][] = [];
  const across = Math.floor(g.w / T);
  for (let j = 0; j < Math.floor(g.h / T); j++) {
    const row: string[] = [];
    for (let i = 0; i < across; i++) {
      const t = new Grid(T, T);
      t.px = g.px.slice(j * T, (j + 1) * T).map((r) => r.slice(i * T, (i + 1) * T));
      const name = `${prefix}-${j * across + i}`;
      tiles.push([name, t]);
      row.push(name);
    }
    rows.push(row);
  }
  return [tiles, rows];
}

function streetTiles(): [Tile[], Pieces] {
  const [door, doorRows] = cut(hotelDoor(), "door");
  return [
    [
      ["sidewalk-top", sidewalk("t")],
      ["sidewalk-top-joint", sidewalk("t", true)],
      ["sidewalk-top-left", sidewalk("tl")],
      ["sidewalk-top-right", sidewalk("tr")],
      ["kerb-left", kerb("l")],
      ["kerb-right", kerb("r")],
      ["sidewalk-face", sidewalk("")],
      ["sidewalk-face-left", sidewalk("l")],
      ["sidewalk-face-right", sidewalk("r")],
      ["road-top", road(true)],
      ["road", road(false)],
      ["one-way-awning-left", awning("l")],
      ["one-way-awning", awning("m")],
      ["one-way-awning-right", awning("r")],
      ["one-way-canopy-left", awning("l", CANOPY)],
      ["one-way-canopy", awning("m", CANOPY)],
      ["one-way-canopy-right", awning("r", CANOPY)],
      ["planter-top-left", planter("tl")],
      ["planter-top", planter("t")],
      ["planter-top-right", planter("tr")],
      ["planter-left", planter("l")],
      ["planter", planter("")],
      ["planter-right", planter("r")],
      ...door.slice(0, 12),
      ...hatchTiles(),
      ...door.slice(12),
      ...crosswalkTiles(),
    ],
    { door: doorRows },
  ];
}

/**
 * The street's tiles in the cool palette: the awnings and the canopy keep their own accent maps,
 * the door and the crosswalk their own colours, every other tile the play map.
 */
export function streetTilesCool(): [Tile[], Pieces] {
  const [tiles, pieces] = streetTiles();
  const m = (name: string): ColourMapping => {
    if (name.startsWith("one-way-awning")) {
      return COOL_AWNING;
    }
    if (name.startsWith("one-way-canopy")) {
      return COOL_CANOPY;
    }
    if (name.startsWith("door-") || name.startsWith("crosswalk-")) {
      return {};
    }
    return COOL_TILES;
  };
  return [tiles.map(([n, g]) => [n, recolour(g, m(n))] as const), pieces];
}

/** Appended after the door so every earlier index holds. */
function hatchTiles(): Tile[] {
  const [lt, lb] = splitLeaf("l");
  const [rt, rb] = splitLeaf("r");
  return [
    ["hatch-left", hatchEdge("l")],
    ["hatch-right", hatchEdge("r")],
    ["pit-opening", pit()],
    ["pit-leaf-left-top", lt],
    ["pit-leaf-left", lb],
    ["pit-leaf-right-top", rt],
    ["pit-leaf-right", rb],
  ];
}

// ---------------------------------------------------------------- lobby tiles

// The boutique lobby: wood walls a step darker than everything she stands on. Every walkable top,
// the floor and each one-way ledge, carries the same 2px cream lip under a 1px plum edge, so in
// greyscale the standable edges are the brightest lines in the room. Indoor scale: a door is 180px
// (15 tiles).
const LE = "plum";

/** Wood floor: a cream lip, brown boards with a 2px dark-brown board end every 24px, a dark-brown face. */
function floor(kind: string, joint = false): Grid {
  const g = new Grid(T, T);
  if (kind.includes("t")) {
    surface(g, LE, "cream", "brown", "dbrown");
    if (joint) {
      rects(g, [T - 2, 3, 2, 7, "dbrown"]);
    }
    return ends(g, kind, LE, "cream", "dbrown", 1);
  }
  rects(g, [0, 0, T, T, "dbrown"]);
  return ends(g, kind, LE, "brown", "plum");
}

// One-way ledge styles: lip, top, face, bracket (null: no brackets).
const LEDGES: Readonly<Record<string, readonly [string, string, string, string | null]>> = {
  balcony: ["cream", "tan", "brown", null], // the mezzanine floor's front edge
  shelf: ["cream", "tan", "brown", "dbrown"], // bookcase and wall shelves
  cushion: ["cream", "mauve", "purple", null], // the sofa's seat and back
  desk: ["cream", "tan", "dbrown", null], // the reception desk's top
};

function ledge(style: string, kind: string): Grid {
  const [lip, top, face, bracket] = LEDGES[style] as (typeof LEDGES)[string];
  const g = rects(
    new Grid(T, T),
    [0, 0, T, 1, LE],
    [0, 1, T, 2, lip],
    [0, 3, T, 2, top],
    [0, 5, T, 1, face],
    [0, 6, T, 1, LE],
  );
  if (kind === "l") {
    rects(g, [0, 0, 1, 7, null], [1, 1, 1, 5, LE]);
  }
  if (kind === "r") {
    rects(g, [T - 1, 0, 1, 7, null], [T - 2, 1, 1, 5, LE]);
  }
  if (bracket && (kind === "l" || kind === "r")) {
    const bx = kind === "l" ? 4 : T - 6;
    rects(g, [bx, 7, 2, 4, bracket], [bx, 11, 2, 1, LE]);
  }
  return g;
}

/** A wood post, 2 tiles wide: brown with a tan lit band and a dark-brown shade; cream-capped cap and base. */
function post(kind: string): Grid {
  const left = kind.endsWith("l");
  const g = rects(new Grid(T, T), [0, 0, T, T, "brown"]);
  if (left) {
    rects(g, [0, 0, 1, T, LE], [1, 0, 2, T, "tan"]);
  } else {
    rects(g, [T - 3, 0, 2, T, "dbrown"], [T - 1, 0, 1, T, LE]);
  }
  if (kind.startsWith("cap")) {
    rects(g, [0, 0, T, 1, LE], [0, 1, T, 2, "cream"], [0, 3, T, 3, "tan"], [0, 6, T, 1, LE]);
  }
  if (kind.startsWith("base")) {
    rects(g, [0, 4, T, 1, LE], [0, 5, T, 2, "cream"], [0, 7, T, 5, "tan"]);
  }
  if (kind.startsWith("cap") || kind.startsWith("base")) {
    rects(g, left ? [0, 0, 1, T, LE] : [T - 1, 0, 1, T, LE]);
  }
  return g;
}

/**
 * The exit to the next floor, 84x180 (a door at indoor scale): a tan frame round an opening with
 * stairs rising to the right, and a white up-arrow on a green sign over it.
 */
function stairwell(): Grid {
  const g = rects(
    new Grid(84, 180),
    [0, 0, 84, 180, LE],
    [2, 2, 80, 178, "tan"],
    [2, 2, 4, 178, "cream"],
    [76, 6, 4, 174, "brown"],
    [22, 6, 40, 24, "forest"],
    [24, 8, 36, 20, "dgreen"],
    [10, 36, 64, 144, "ink"],
    [12, 38, 60, 142, "navy"],
  );
  for (let k = 0; k < 6; k++) {
    rects(g, [41 - k * 2, 11 + k * 2, 2 + k * 4, 2, "white"]);
  }
  rects(g, [39, 23, 6, 4, "white"]);
  for (let i = 0; i < 6; i++) {
    const sx = 12 + i * 10;
    const sy = 166 - i * 22;
    rects(g, [sx, sy, 72 - sx, 180 - sy, "dslate"], [sx, sy, 72 - sx, 4, "slate"]);
  }
  rects(g, [12, 38, 60, 8, "ink"]);
  return g;
}

function lobbyTiles(): [Tile[], Pieces] {
  const tiles: Tile[] = [
    ["floor-top", floor("t")],
    ["floor-top-joint", floor("t", true)],
    ["floor-top-left", floor("tl")],
    ["floor-top-right", floor("tr")],
    ["floor-face", floor("")],
    ["floor-face-left", floor("l")],
    ["floor-face-right", floor("r")],
  ];
  for (const style of Object.keys(LEDGES)) {
    tiles.push(
      [`one-way-${style}-left`, ledge(style, "l")],
      [`one-way-${style}`, ledge(style, "m")],
      [`one-way-${style}-right`, ledge(style, "r")],
    );
  }
  tiles.push(
    ["post-cap-left", post("cap-l")],
    ["post-cap-right", post("cap-r")],
    ["post-left", post("l")],
    ["post-right", post("r")],
    ["post-base-left", post("base-l")],
    ["post-base-right", post("base-r")],
  );
  const [exitTiles, exitRows] = cut(stairwell(), "exit");
  return [[...tiles, ...exitTiles], { exit: exitRows }];
}

const TILESET_DEFS: readonly (readonly [key: string, fn: () => [Tile[], Pieces]])[] = [
  ["tiles-street", streetTilesCool],
  ["tiles-lobby", lobbyTiles],
];

function tilesetImage(tiles: readonly Tile[]): RgbaImage {
  const rows = Math.ceil(tiles.length / COLUMNS);
  const im = filledImage([0, 0, 0, 0], COLUMNS * T, rows * T);
  tiles.forEach(([, g], i) =>
    composite({ x: (i % COLUMNS) * T, y: Math.floor(i / COLUMNS) * T }, frameImage(g.px), im),
  );
  return im;
}

// ---------------------------------------------------------------- crosswalk

const CROSSWALK_PHASES = ["walk", "warning", "traffic"] as const;
const CROSSWALK_ENDS = [
  ["left", "l"],
  ["middle", "m"],
  ["right", "r"],
] as const;
const WARNING_BORDER = 4;

/** One crosswalk cell: kind is l, m or r, the strip's left end, an inner cell or its right end. */
function crosswalk(phase: (typeof CROSSWALK_PHASES)[number], kind: string): Grid {
  const g = new Grid(T, T);
  if (phase === "traffic") {
    return rects(g, [0, 0, T, T, "red"]);
  }
  rects(g, [0, 0, T, T, "dslate"], [3, 2, 6, 8, "lgrey"]);
  if (phase === "warning") {
    const b = WARNING_BORDER;
    rects(g, [0, 0, T, b, "amber"], [0, T - b, T, b, "amber"]);
    if (kind === "l") {
      rects(g, [0, 0, b, T, "amber"]);
    }
    if (kind === "r") {
      rects(g, [T - b, 0, b, T, "amber"]);
    }
  }
  return g;
}

/** Appended after every earlier tile so its index holds. */
function crosswalkTiles(): Tile[] {
  return CROSSWALK_PHASES.flatMap((phase) =>
    CROSSWALK_ENDS.map(([end, kind]): Tile => [
      `crosswalk-${phase}-${end}`,
      crosswalk(phase, kind),
    ]),
  );
}

// Signal glyphs, one row per string: x is the glyph's colour, . is clear.
const SIGNAL_HAND = [
  ".x.x.x..",
  ".x.x.x..",
  ".x.x.x.x",
  ".xxxxxxx",
  ".xxxxxx.",
  "..xxxxx.",
  "..xxxx..",
] as const;
const SIGNAL_WALKER = [
  "...xx...",
  "...xx...",
  "..xxx...",
  ".x.xxx..",
  ".x.xx.x.",
  "...xx...",
  "..x..x..",
  "..x...x.",
  ".x....x.",
] as const;

function glyph(g: Grid, x: number, y: number, rows: readonly string[], c: string): void {
  rows.forEach((row, j) => {
    [...row].forEach((cell, i) => {
      if (cell === "x") {
        g.p(x + i, y + j, c);
      }
    });
  });
}

/** 12x84: the pedestrian signal, its hand lit amber or dark and its walker lit white or dark. */
function crosswalkSignal(hand: boolean, walker: boolean): pixel.Frame {
  const g = rects(
    new Grid(12, 84),
    [0, 0, 12, 26, "ink"],
    [1, 1, 10, 24, "dslate"],
    [2, 2, 8, 10, "ink"],
    [2, 14, 8, 11, "ink"],
    [4, 26, 4, 54, "ink"],
    [5, 26, 2, 54, "slate"],
    [2, 79, 8, 5, "ink"],
    [3, 80, 6, 3, "dslate"],
  );
  glyph(g, 2, 3, SIGNAL_HAND, hand ? "amber" : "navy");
  glyph(g, 2, 15, SIGNAL_WALKER, walker ? "white" : "navy");
  return g.px;
}

const SIGNAL_ONCE = { "crosswalk-signal": [] };

export function* sprites(): Generator<pixel.SpriteEntry> {
  yield [
    "crosswalk-signal",
    [
      ["walk", [crosswalkSignal(false, true)], 1000],
      ["warning", [crosswalkSignal(true, false), crosswalkSignal(false, false)], 250],
      ["stop", [crosswalkSignal(true, false)], 1000],
    ],
  ];
}

// ---------------------------------------------------------------- backdrops

// Sign icons, 11x11, one colour on a navy board. Signs are icons, never text.
const ICONS: Readonly<Record<string, readonly string[]>> = {
  cafe: [
    "..#..#.....",
    "...#..#....",
    "..#..#.....",
    "...........",
    "#########..",
    "#########.#",
    "#########.#",
    "#########.#",
    ".#######.#.",
    "..#####....",
    "###########",
  ],
  "noodle-bar": [
    ".........#.",
    "........#..",
    ".......#.#.",
    "......#.#..",
    ".....#.#...",
    "###########",
    "###########",
    ".#########.",
    "..#######..",
    "...#####...",
    "..#######..",
  ],
};

// kind: width (whole tiles), frame colour. Frames are dim so the shops stay behind the play layer.
const SHOPS: Readonly<Record<string, readonly [width: number, frame: string]>> = {
  cafe: [84, "forest"],
  "noodle-bar": [120, "teal"],
};

// Building facades: wall, line (storey lines, frames, mortar), trim (sills, parapet).
const BUILDINGS: Readonly<Record<string, readonly [wall: string, line: string, trim: string]>> = {
  "one-storey": ["dbrown", "plum", "brown"],
  brownstone: ["plum", "ink", "dbrown"],
};

function icon(g: Grid, kind: string, x: number, y: number, c: string): void {
  (ICONS[kind] as readonly string[]).forEach((row, j) => {
    [...row].forEach((ch, i) => {
      if (ch === "#") {
        g.p(x + i, y + j, c);
      }
    });
  });
}

/** 48x600, repeat x: one flat powder-blue atmosphere, fixed behind the scrolling city layers. */
function streetSky(): Grid {
  return rects(new Grid(48, STREET_FY), [0, 0, 48, STREET_FY, "zone-blue"]);
}

type Block = readonly [x: number, width: number, top: number, tank: boolean];

/** Window-free silhouettes, with occasional small water tanks, on a seamless 720px repeat. */
function cityBlocks(g: Grid, colour: string, blocks: readonly Block[]): Grid {
  for (const [x, width, top, tank] of blocks) {
    rects(g, [x, top, width, STREET_FY - top, colour]);
    if (tank) {
      rects(
        g,
        [x + 12, top - 18, 18, 14, colour],
        [x + 14, top - 4, 2, 4, colour],
        [x + 26, top - 4, 2, 4, colour],
      );
      g.tri([x + 10, top - 18], [x + 21, top - 26], [x + 32, top - 18], colour);
    }
  }
  return g;
}

/** 720x600 repeating window-free city masses, softened by the canonical powder-blue haze. */
function streetCityFar(): Grid {
  const g = cityBlocks(new Grid(720, STREET_FY), "zone-blue-shade", [
    [0, 112, 350, false],
    [138, 70, 292, true],
    [228, 104, 324, false],
    [356, 82, 248, false],
    [462, 108, 338, false],
    [594, 126, 304, true],
  ]);
  rects(
    g,
    [18, 332, 60, 18, "zone-blue-shade"],
    [374, 228, 46, 20, "zone-blue-shade"],
    [482, 322, 68, 16, "zone-blue-shade"],
  );
  return g;
}

/** 720x600 repeating complete low-rise blocks, varied roof masses and broad quiet recesses. */
function streetCityMid(): Grid {
  const g = cityBlocks(new Grid(720, STREET_FY), "slate", [
    [20, 138, 442, false],
    [208, 110, 406, false],
    [372, 144, 462, false],
    [572, 126, 424, false],
  ]);
  rects(
    g,
    [28, 434, 122, 8, "slate"],
    [224, 394, 78, 12, "slate"],
    [390, 450, 108, 12, "slate"],
    [584, 412, 102, 12, "slate"],
    [40, 480, 96, 12, "zone-blue-shade"],
    [230, 450, 66, 10, "zone-blue-shade"],
    [398, 496, 92, 10, "zone-blue-shade"],
  );
  return g;
}

/** 720x600 repeating low service roofs with broad gaps revealing the city beyond; no play lips. */
function streetBoundaryMid(): Grid {
  const g = cityBlocks(new Grid(720, STREET_FY), "slate", [
    [32, 160, 504, false],
    [292, 104, 532, false],
    [520, 168, 492, false],
  ]);
  rects(
    g,
    [48, 494, 128, 10, "slate"],
    [542, 480, 124, 12, "slate"],
    [52, 536, 116, 10, "zone-blue-shade"],
    [544, 526, 120, 10, "zone-blue-shade"],
  );
  return g;
}

/**
 * One repeating 48px slice of a building front from the top of the screen to the sidewalk line:
 * the ground storey is 180px (y 132 to 312) with a band at y 206 over the shopfronts; above it the
 * next storey's windows. The one-storey building stops at a parapet at y 120.
 */
function facade(kind: string): Grid {
  const [wall, line, trim] = BUILDINGS[kind] as (typeof BUILDINGS)[string];
  if (kind === "one-storey") {
    return rects(
      new Grid(48, 192),
      [0, 0, 48, 192, wall],
      [0, 0, 48, 6, trim],
      [0, 6, 48, 4, line],
      [0, 86, 48, 4, line],
    );
  }
  const g = rects(
    new Grid(48, FY),
    [0, 0, 48, FY, wall],
    [0, 124, 48, 8, line],
    [0, 122, 48, 2, trim],
    [0, 206, 48, 4, line],
  );
  rects(
    g,
    [11, 50, 26, 58, line],
    [14, 53, 20, 52, "navy"],
    [23, 53, 2, 52, line],
    [9, 108, 30, 4, trim],
  );
  rects(g, [9, 44, 30, 6, trim]); // a stone lintel over each window
  return g;
}

/**
 * A shopfront, w x 120 (y 192 to 312): a frame in the shop's colour, a navy sign board with its
 * icon, a tall display window under a transom, and a 46px door under its own transom. An awning
 * (one-way, row 20) fits across it below the sign.
 */
function storefront(kind: string): Grid {
  const [w, frame] = SHOPS[kind] as (typeof SHOPS)[string];
  const edge = darker(frame);
  const g = rects(
    new Grid(w, 120),
    [0, 0, w, 120, frame],
    [4, 2, w - 8, 18, "ink"],
    [5, 3, w - 10, 16, "navy"],
    [4, 26, w - 34, 86, edge],
    [6, 28, w - 38, 82, "dslate"],
    [6, 44, w - 38, 2, edge],
    [10, 50, 2, 24, "slate"],
    [14, 50, 2, 12, "slate"],
    [w - 28, 26, 24, 94, edge],
    [w - 26, 28, 20, 42, "dslate"],
    [w - 26, 74, 20, 46, edge],
    [w - 23, 78, 14, 18, "dslate"],
  );
  icon(g, kind, Math.floor(w / 2) - 5, 6, "cream");
  return g;
}

/** 12x82: a pole with the signal box at the top showing the white walking figure. */
function walkSignal(): Grid {
  return rects(
    new Grid(12, 82),
    [4, 6, 2, 76, "ink"],
    [0, 0, 10, 12, "ink"],
    [4, 2, 2, 2, "white"],
    [3, 4, 4, 4, "white"],
    [3, 8, 1, 3, "white"],
    [6, 8, 1, 3, "white"],
  );
}

/**
 * The top of a building, 48x48, repeat x: plain wall under a 4px trim band at the top, placed on
 * the topmost facade piece, where the roof is.
 */
function roofline(kind: string): Grid {
  const [wall, line, trim] = BUILDINGS[kind] as (typeof BUILDINGS)[string];
  return rects(new Grid(48, 48), [0, 0, 48, 48, wall], [0, 0, 48, 4, trim], [0, 4, 48, 2, line]);
}

/**
 * 48x24, repeat x: a fire-escape's ink railing, a top rail and 2px balusters every 12px, standing
 * on a ledge (its bottom at the ledge tiles' top edge).
 */
function fireEscapeRailing(): Grid {
  const g = rects(new Grid(48, 24), [0, 0, 48, 2, "ink"], [0, 10, 48, 2, "ink"]);
  for (const x of [0, 12, 24, 36]) {
    rects(g, [x, 0, 2, 24, "ink"]);
  }
  return g;
}

type Repeat = "x" | "none";
/** [draw, anchor y, repeat]. */
type BackdropDef = readonly [draw: () => Grid, y: number, repeat: Repeat];

const STREET_DEFS = new Map<string, BackdropDef>([
  ["street-sky", [streetSky, STREET_FY, "x"]],
  ["street-city-far", [streetCityFar, STREET_FY, "x"]],
  ["street-city-mid", [streetCityMid, STREET_FY, "x"]],
  ["street-boundary-mid", [streetBoundaryMid, STREET_FY, "x"]],
  ...Object.keys(BUILDINGS).map((k): [string, BackdropDef] => [
    `facade-${k}`,
    [() => facade(k), STREET_FY, "x"],
  ]),
  ...Object.keys(SHOPS).map((k): [string, BackdropDef] => [
    `storefront-${k}`,
    [() => storefront(k), STREET_FY, "none"],
  ]),
  ["walk-signal", [walkSignal, STREET_FY, "none"]],
  ["roofline-brownstone", [() => roofline("brownstone"), 108, "x"]],
  ["fire-escape-railing", [fireEscapeRailing, 432, "x"]],
]);
// The street's pieces in the cool palette; the sky and city layers are drawn in it already.
const NEAR_FOR = new Map<string, ColourMapping>();
// Quiet glass stays one value step below the architecture; shop icons keep their cream callout.
for (const key of STREET_DEFS.keys()) {
  if (key.startsWith("facade-") || key.startsWith("storefront-")) {
    NEAR_FOR.set(key, { ...COOL_NEAR, navy: "dslate" });
  }
}
const ATMOSPHERE_KEYS = new Set([
  "street-sky",
  "street-city-far",
  "street-city-mid",
  "street-boundary-mid",
]);
export const BACKDROP_DEFS = new Map<string, BackdropDef>([
  ...[...STREET_DEFS].map(([k, [fn, y, rep]]): [string, BackdropDef] => [
    k,
    [ATMOSPHERE_KEYS.has(k) ? fn : cool(fn, NEAR_FOR.get(k) ?? COOL_NEAR), y, rep],
  ]),
]);

// ---------------------------------------------------------------- export

function lookup<T>(map: ReadonlyMap<string, T>, key: string): T {
  const value = map.get(key);
  if (value === undefined) {
    throw new Error(`Unknown key ${key}`);
  }
  return value;
}

export async function build(): Promise<void> {
  // One tileset at a time, in definition order.
  const tilesets = await TILESET_DEFS.reduce<Promise<pixel.ManifestEntry[]>>(
    async (previous, [key, fn]) => {
      const written = await previous;
      const [tiles, pieces] = fn();
      const entry = await pixel.writeTileset(
        { key, pieces },
        tiles.map(([n, g]) => [n, frameToRgba({ resolveRgb: rgb }, g.px)] as const),
      );
      return [...written, entry];
    },
    Promise.resolve([]),
  );
  const backdrops: pixel.ManifestEntry[] = [];
  for (const [key, [fn, y, repeat]] of BACKDROP_DEFS) {
    const g = fn();
    const image = backgroundTones.apply(key, frameImage(g.px));
    writeImage(`${BACKDROPS}/${key}.png`, image);
    backdrops.push({
      key,
      png: `backdrops/${key}.png`,
      width: g.w,
      height: g.h,
      anchor: "bottom-left",
      y,
      repeat,
    });
  }
  // Merged by key, so the park theme's entries stay; a piece floor1.ts stops drawing is removed by
  // hand.
  pixel.updateManifest("tilesets", tilesets);
  pixel.updateManifest("backdrops", backdrops);
  await pixel.build({ once: SIGNAL_ONCE }, [...sprites()]);
  console.log(
    "built",
    TILESET_DEFS.map(([k]) => k).join(", "),
    "and",
    backdrops.length,
    "backdrops",
  );
}

// ---------------------------------------------------------------- preview: example layouts

type Run = readonly [key: string, x0: number, x1: number, y: number];
type Piece = readonly [key: string, x: number, y: number];
type LedgeRow = readonly [kind: string, row: number, c0: number, w: number];

// One example street for the preview only: a 720x720 column (60x60 tiles, two screens tall) with
// the sidewalk along the bottom (its top at row 50, y 600, ground below) and a climb to the roof,
// built to the reaches (a hop rises 3 tiles, a full jump 8). Backdrop runs are [key, x0, x1, bottom
// y]; pieces [key, x, bottom y]; one-way rows [tile, row, first col, width].
const STREET_EXAMPLE: {
  runs: readonly Run[];
  pieces: readonly Piece[];
  ledges: readonly LedgeRow[];
  planter: readonly [c0: number, w: number];
} = {
  runs: [
    ["street-sky", 0, 720, STREET_FY],
    ["street-city-far", 0, 720, STREET_FY],
    ["street-city-mid", 0, 720, STREET_FY],
    ["facade-brownstone", 0, 528, STREET_FY],
    ["roofline-brownstone", 0, 528, 288],
    ["facade-one-storey", 528, 720, STREET_FY],
    ["fire-escape-railing", 72, 216, 432],
    ["fire-escape-railing", 72, 216, 336],
  ],
  pieces: [
    ["storefront-noodle-bar", 288, STREET_FY],
    ["storefront-cafe", 588, STREET_FY],
  ],
  ledges: [
    ["awning", 44, 24, 6],
    ["canopy", 36, 6, 12],
    ["canopy", 28, 6, 12],
  ],
  planter: [20, 3],
};

function compose(
  im: RgbaImage,
  defs: ReadonlyMap<string, BackdropDef>,
  runs: readonly Run[],
  pieces: readonly Piece[],
): void {
  const images = new Map<string, RgbaImage>();
  const art = (key: string): RgbaImage => {
    let image = images.get(key);
    if (!image) {
      image = frameImage(lookup(defs, key)[0]().px);
      images.set(key, image);
    }
    return image;
  };
  for (const [key, x0, x1, y] of runs) {
    const p = art(key);
    for (let x = x0; x < x1; x += p.width) {
      const q = crop({ x: 0, y: 0, width: Math.min(p.width, x1 - x), height: p.height }, p);
      composite({ x, y: y - q.height }, q, im);
    }
  }
  for (const [key, x, y] of pieces) {
    const p = art(key);
    composite({ x, y: y - p.height }, p, im);
  }
}

// The touch buttons as the style guide's touch controls place them: [sprite, centre].
const BUTTONS = [
  ["ui-touch-use", [598, 203]],
  ["ui-touch-jump", [675, 303]],
] as const;

/** Draw the Use and Jump buttons' rest frame on each screen whose top is in tops. */
function touchButtons(im: RgbaImage, tops: readonly number[]): void {
  for (const [key, [cx, cy]] of BUTTONS) {
    const sheet = JSON.parse(readFileSync(`${SPRITES}/${key}.json`, "utf8")) as {
      frames: Record<string, { frame: { w: number; h: number } }>;
    };
    const first = Object.values(sheet.frames)[0];
    if (!first) {
      throw new Error(`${key}: no frames`);
    }
    const fr = first.frame;
    const b = crop({ x: 0, y: 0, width: fr.w, height: fr.h }, readImage(`${SPRITES}/${key}.png`));
    for (const top of tops) {
      composite(
        { x: cx - Math.floor((fr.w - 1) / 2), y: top + cy - Math.floor((fr.h - 1) / 2) },
        b,
        im,
      );
    }
  }
}

function inkImage(width: number, height: number): RgbaImage {
  return filledImage([...rgb("ink"), 255], width, height);
}

function birdFrame(): RgbaImage {
  return crop({ x: 0, y: 0, width: 48, height: 42 }, readImage(`${SPRITES}/bird.png`));
}

const side = (c: number, c0: number, w: number): string =>
  c === c0 ? "-left" : c === c0 + w - 1 ? "-right" : "";

function tileImages(tiles: readonly Tile[]): Map<string, RgbaImage> {
  return new Map(tiles.map(([name, g]) => [name, frameImage(g.px)]));
}

function streetExample(chars = true, hud = true): RgbaImage {
  const entries = STREET_EXAMPLE;
  const tiles = tileImages(streetTilesCool()[0]);
  const im = inkImage(720, 720);
  compose(im, BACKDROP_DEFS, entries.runs, entries.pieces);
  const ground = Math.floor(STREET_FY / T);
  for (let r = ground; r < 60; r++) {
    for (let c = 0; c < 60; c++) {
      const name = r === ground ? (c % 2 ? "sidewalk-top-joint" : "sidewalk-top") : "sidewalk-face";
      composite({ x: c * T, y: r * T }, lookup(tiles, name), im);
    }
  }
  const [p0, pw] = entries.planter;
  for (const [r, part] of [
    [ground - 2, "top"],
    [ground - 1, ""],
  ] as const) {
    for (let c = p0; c < p0 + pw; c++) {
      const s = side(c, p0, pw);
      const name = part ? `planter-${part}${s}` : `planter${s}`;
      composite({ x: c * T, y: r * T }, lookup(tiles, name), im);
    }
  }
  for (const [kind, row, c0, w] of entries.ledges) {
    for (let c = c0; c < c0 + w; c++) {
      composite({ x: c * T, y: row * T }, lookup(tiles, `one-way-${kind}${side(c, c0, w)}`), im);
    }
  }
  if (chars) {
    composite({ x: 150 - 24, y: 28 * T - 42 }, birdFrame(), im);
  }
  if (hud) {
    touchButtons(im, [0, 360]);
  }
  return opaque(im);
}

export function preview(out: string): void {
  const strip = streetExample();
  const sheets: RgbaImage[] = [];
  for (const [, fn] of TILESET_DEFS) {
    const [tiles] = fn();
    const ts = tilesetImage(tiles);
    const bg = filledImage([...rgb("dslate"), 255], ts.width, ts.height);
    composite({ x: 0, y: 0 }, ts, bg);
    sheets.push(resizeNearest(ts.width * 4, ts.height * 4, opaque(bg)));
  }
  const gap = 16;
  const x0 = strip.width + gap;
  const sheet = inkImage(
    x0 + Math.max(...sheets.map((s) => s.width)),
    Math.max(
      strip.height,
      sheets.reduce((sum, s) => sum + s.height + gap, 0),
    ),
  );
  paste({ at: { x: 0, y: 0 } }, strip, sheet);
  let y = 0;
  for (const s of sheets) {
    paste({ at: { x: x0, y } }, s, sheet);
    y += s.height + gap;
  }
  writeFileSync(out, encodeRgbPng(PNG_OPTIONS, sheet));
}

if (import.meta.main) {
  run(() => commands({ usage: USAGE, build, preview }));
}
