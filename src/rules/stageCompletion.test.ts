import { describe, expect, it } from "vitest";

import type { ZoneMap } from "../data/types";
import { DESTINATION_FIXTURE as MAP } from "../testing/mapDestinations";
import { stageCompletion } from "./stageCompletion";

describe("stage completion routing", () => {
  it.each([
    { before: [], expected: { kind: "next-stage", stage: "two" }, stage: "one" },
    {
      before: ["one", "two", "three"],
      expected: { kind: "next-stage", stage: "two" },
      stage: "one",
    },
    { before: ["one"], expected: { kind: "map", travelTo: "three" }, stage: "two" },
    { before: ["one", "two", "three"], expected: { kind: "map", travelTo: "three" }, stage: "two" },
    { before: ["one", "two", "three"], expected: { kind: "celebration" }, stage: "four" },
    { before: ["one", "two", "three", "four"], expected: { kind: "celebration" }, stage: "four" },
  ])("$stage with completed $before", ({ before, expected, stage }) => {
    expect(stageCompletion(MAP, new Set(before), stage)).toEqual(expected);
  });
  it("continues through every intermediate stage before leaving its destination", () => {
    const three: ZoneMap = {
      ...MAP,
      destinations: MAP.destinations.map((destination, index) =>
        index === 0 ? { ...destination, stages: ["one", "middle", "two"] as const } : destination,
      ),
      edges: [
        ...MAP.edges.filter((edge) => edge.from !== "one"),
        { built: true, from: "one", to: "middle" },
        { built: true, from: "middle", to: "two" },
      ],
      nodes: [...MAP.nodes, { at: { col: 0, row: 0 }, id: "middle", kind: "zone", zone: "middle" }],
    };
    expect(stageCompletion(three, new Set(), "one")).toEqual({
      kind: "next-stage",
      stage: "middle",
    });
    expect(stageCompletion(three, new Set(["one"]), "middle")).toEqual({
      kind: "next-stage",
      stage: "two",
    });
    expect(stageCompletion(three, new Set(["one", "middle"]), "two")).toEqual({
      kind: "map",
      travelTo: "three",
    });
    const blocked = { ...three, edges: three.edges.filter((edge) => edge.from !== "middle") };
    expect(() => stageCompletion(blocked, new Set(["one"]), "middle")).toThrow(
      "unavailable stage two",
    );
  });
  it("never chooses an unbuilt successor or an arbitrary fork", () => {
    const unbuilt = {
      ...MAP,
      nodes: MAP.nodes.map((node) =>
        node.id === "three" ? { at: node.at, id: node.id, kind: "zone" as const } : node,
      ),
    };
    expect(stageCompletion(unbuilt, new Set(["one"]), "two")).toEqual({ kind: "map" });
    const branching = {
      ...MAP,
      edges: [...MAP.edges, { built: true, from: "two", to: "choice" }],
      nodes: [...MAP.nodes, { at: { col: 0, row: 0 }, id: "choice", kind: "fork" as const }],
    };
    expect(stageCompletion(branching, new Set(["one"]), "two")).toEqual({ kind: "map" });
  });
});
