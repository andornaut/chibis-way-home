import { describe, expect, it } from "vitest";

import type { ZoneMap } from "../data/types";
import { isLastZone, openMap, pathsFrom } from "./map";

// a, then a fork f with built paths to b and c and an unbuilt one to d, all three joining at the
// finish z, a fork.
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
    ...["a", "b", "c", "d"].map((id) => ({
      at: { col: 0, row: 0 },
      id,
      kind: "zone" as const,
      zone: id,
    })),
    ...["f", "z"].map((id) => ({ at: { col: 0, row: 0 }, id, kind: "fork" as const })),
  ],
  start: "a",
};

describe("pathsFrom", () => {
  it.each([
    ["a", ["f"]],
    ["f", ["b", "c", "d"]],
    ["z", []],
  ])("leads on from %s to %j, built or not", (at, to) => {
    expect(pathsFrom(MAP, at).map(({ node }) => node.id)).toEqual(to);
  });
});

describe("openMap", () => {
  // With c's path on to e, a zone node with no zone yet.
  const WITH_E: ZoneMap = {
    ...MAP,
    edges: [...MAP.edges, { built: true, from: "c", to: "e" }],
    nodes: [...MAP.nodes, { at: { col: 0, row: 0 }, id: "e", kind: "zone" }],
  };
  const path = (from: string, to: string) => `${from}-${to}`;

  it.each([
    ["nothing completed: the first zone alone", MAP, [], ["a"], []],
    [
      "the first zone completed: on through the fork to its built zones",
      MAP,
      ["a"],
      ["a", "b", "c"],
      ["a-f", "f-b", "f-c"],
    ],
    [
      "a zone past the fork completed: on to the finish",
      MAP,
      ["a", "b"],
      ["a", "b", "c"],
      ["a-f", "f-b", "f-c", "b-z"],
    ],
    ["a later zone completed but not the first: the first blocks it", MAP, ["b"], ["a"], []],
    [
      "a path on to a zone node with no zone yet: closed",
      WITH_E,
      ["a", "c"],
      ["a", "b", "c"],
      ["a-f", "f-b", "f-c", "c-z"],
    ],
  ])("%s", (_, map, completed, zones, edges) => {
    const open = openMap(map, new Set(completed));
    expect({
      edges: open.edges.map(({ from, to }) => path(from, to)),
      zones: open.zones,
    }).toEqual({ edges, zones });
  });
});

describe("isLastZone", () => {
  const actualFinish: ZoneMap = { ...MAP, finish: "c" };
  const unbuiltFinish: ZoneMap = {
    ...actualFinish,
    nodes: actualFinish.nodes.map((node) =>
      node.id === "c" ? { at: node.at, id: node.id, kind: "zone" } : node,
    ),
  };
  it.each([
    ["the final actual stage", actualFinish, "c", true],
    ["the stage before another stage", actualFinish, "a", false],
    ["another completed branch", actualFinish, "b", false],
    ["an unbuilt final stage", unbuiltFinish, "c", false],
    ["a routing fork", MAP, "z", false],
  ] as const)("recognizes %s without early celebration", (_, map, id, last) => {
    expect(isLastZone(map, id)).toBe(last);
  });
});
