import { describe, expect, it } from "vitest";

import type { MapEdge, ZoneMap } from "../data/types";
import { MAP_SCREEN } from "../layout/mapScreen";
import { nodeOf, openMap } from "../rules/map";
import { markerState, nodeCentre, pathLook, steppedZone, zoneAtTap } from "./mapMarks";

// a, then a fork f a row down with built paths to b, up a row, and c, level, and an unbuilt one to
// d, all three joining at the finish z, a fork.
const MAP: ZoneMap = {
  decorations: [],
  destinations: [],
  edges: [
    { built: true, from: "a", to: "f" },
    { built: true, from: "f", to: "b" },
    { built: true, from: "f", to: "c" },
    { built: false, from: "f", to: "d" },
    { built: true, from: "b", to: "z" },
    { built: true, from: "c", to: "z" },
    { built: false, from: "d", to: "z" },
  ],
  finish: "z",
  nodes: [
    { at: { col: 0, row: 4 }, id: "a", kind: "zone", zone: "a" },
    { at: { col: 2, row: 5 }, id: "f", kind: "fork" },
    { at: { col: 4, row: 4 }, id: "b", kind: "zone", zone: "b" },
    { at: { col: 4, row: 5 }, id: "c", kind: "zone", zone: "c" },
    { at: { col: 4, row: 6 }, id: "d", kind: "zone" },
    { at: { col: 6, row: 5 }, id: "z", kind: "fork" },
  ],
  start: "a",
};
// Nothing completed, and a completed, which opens b and c through the fork.
const NONE = openMap(MAP, new Set());
const DONE_A = openMap(MAP, new Set(["a"]));

const edge = (from: string, to: string): MapEdge => {
  const found = MAP.edges.find((each) => each.from === from && each.to === to);
  if (!found) {
    throw new Error(`No edge ${from} ${to}`);
  }
  return found;
};

describe("nodeCentre", () => {
  it.each([
    [12, "a", { x: 6, y: 54 }],
    [10, "f", { x: 25, y: 55 }],
  ])("centres a node in its %i px tile: %s at %j", (tile, id, centre) => {
    expect(nodeCentre(tile, nodeOf(MAP, id))).toEqual(centre);
  });
});

describe("markerState", () => {
  it.each([
    ["a", "c", "visited"],
    ["c", "c", "current"],
    ["b", "c", "normal"],
    ["f", "c", "normal"],
    ["d", "c", "unbuilt"],
  ])("marks %s, standing on %s with a completed, %s", (id, stand, state) => {
    expect(markerState(MAP, DONE_A, new Set(["a"]), stand, nodeOf(MAP, id))).toBe(state);
  });

  // With nothing completed, standing on the finish fork z, only a is open: b and c lie past it,
  // and the fork f never locks.
  it.each([
    ["a", "normal"],
    ["b", "locked"],
    ["c", "locked"],
    ["f", "normal"],
  ])("marks %s, with nothing completed, %s", (id, state) => {
    expect(markerState(MAP, NONE, new Set(), "z", nodeOf(MAP, id))).toBe(state);
  });
});

describe("pathLook", () => {
  it.each([
    ["a", "f", NONE, "built"],
    ["a", "f", DONE_A, "open"],
    ["f", "b", DONE_A, "open"],
    ["b", "z", DONE_A, "built"],
    ["f", "d", DONE_A, "unbuilt"],
  ])("draws the path from %s to %s as %s", (from, to, open, look) => {
    expect(pathLook(open, edge(from, to))).toBe(look);
  });
});

describe("zoneAtTap", () => {
  // Tiles wide enough that no two nodes' hit areas meet.
  const WIDE = 100;
  const { nodeHit } = MAP_SCREEN;
  const at = (id: string, dx = 0, dy = 0) => {
    const centre = nodeCentre(WIDE, nodeOf(MAP, id));
    return { x: centre.x + dx, y: centre.y + dy };
  };
  const edgeX = nodeHit.width / 2;
  const edgeY = nodeHit.height / 2;

  it.each([
    ["b's centre", DONE_A, at("b"), "b"],
    ["a, behind her", DONE_A, at("a"), "a"],
    ["the corner of b's hit area", DONE_A, at("b", edgeX, edgeY), "b"],
    ["just past c's hit area", DONE_A, at("c", edgeX + 1), undefined],
    ["the unbuilt d", DONE_A, at("d"), undefined],
    ["the fork", DONE_A, at("f"), undefined],
    ["b, before a is completed", NONE, at("b"), undefined],
  ])("lands a tap on %s on %s", (_name, open, point, zone) => {
    expect(zoneAtTap(WIDE, nodeHit, MAP, open, point)).toBe(zone);
  });

  // Nodes a row apart on 30 px tiles: their hit areas overlap between them.
  it.each([
    ["nearer b", -1, "b"],
    ["nearer c", 1, "c"],
  ])("picks the nearer node where hit areas overlap: %s", (_name, offset, zone) => {
    const between = { x: nodeCentre(30, nodeOf(MAP, "b")).x, y: 15 + 30 * 4.5 + offset };
    expect(zoneAtTap(30, nodeHit, MAP, DONE_A, between)).toBe(zone);
  });
});

describe("steppedZone", () => {
  it.each([
    ["a", 1, "b"],
    ["b", 1, "c"],
    ["c", 1, "c"],
    ["b", -1, "a"],
    ["a", -1, "a"],
  ] as const)("steps from %s by %i to %s", (stand, step, zone) => {
    expect(steppedZone(DONE_A, stand, step)).toBe(zone);
  });
});
