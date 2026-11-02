import { expect, it } from "vitest";

import { ARCHETYPES } from "../data/archetypes";
import { CHARACTERS } from "../data/characters";
import type { Instance } from "../data/types";
import { FIXTURE_LIBRARY } from "../testing/chunks";
import { chunkProblems } from "./chunk";

const catalogue = { archetypes: ARCHETYPES, characters: CHARACTERS };
const base = FIXTURE_LIBRARY.chunks["test-finish"]!;
const bird: Instance = { character: "background-swallow", col: 8, row: 35 };
const problems = (instance: Instance) =>
  chunkProblems(FIXTURE_LIBRARY, catalogue, { ...base, scenery: [instance] });

it.each([
  { character: "background-deer", col: 8, row: 35 },
  { character: "background-reeds", col: 8, parallax: { x: 0.4, y: 0.15 }, row: 35 },
  bird,
])("retains safe world and legacy scenery: %j", (instance) => {
  expect(problems(instance)).toEqual([]);
});

it.each([
  { instance: { ...bird, character: "test-hazard" }, name: "collider" },
  { instance: { ...bird, character: "bear-antagonist" }, name: "hostile" },
  {
    instance: { ...bird, overrides: { interaction: { kind: "talk" as const } } },
    name: "interaction",
  },
  { instance: { ...bird, overrides: { reaction: { kind: "avoid" as const } } }, name: "reaction" },
  { instance: { ...bird, phase: 0.5 }, name: "phase" },
  { instance: { ...bird, overrides: { motion: { pause: 1 } } }, name: "pause" },
  {
    instance: { ...bird, overrides: { motion: { algorithm: "static" as const } } },
    name: "static finite track",
  },
  { instance: { ...bird, overrides: { motion: { speed: 0 } } }, name: "zero speed" },
  {
    instance: { ...bird, overrides: { motion: { distance: Infinity } } },
    name: "nonfinite distance",
  },
])("rejects $name instead of exempting world scenery", ({ instance }) => {
  expect(problems(instance).some((problem) => problem.startsWith("scenery "))).toBe(true);
});

it("rejects a world animation graph that senses Chibi", () => {
  const instance: Instance = {
    behaviour: {
      axis: "x",
      distance: 0,
      initial: "idle",
      states: {
        idle: {
          animation: "idle",
          motion: { kind: "wait" },
          transitions: [{ to: "idle", when: [{ kind: "visible" }] }],
        },
      },
    },
    character: "background-deer",
    col: 8,
    row: 35,
  };
  expect(problems(instance).some((problem) => problem.startsWith("scenery "))).toBe(true);
});
