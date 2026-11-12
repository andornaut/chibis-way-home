import type { ZoneMap } from "../data/types/index.ts";

const IDS = ["one", "two", "three", "four"];
const PLANS = Object.fromEntries(IDS.map((id) => [id, {}]));
const AVAILABLE = new Set(IDS);
const MAP: ZoneMap = {
  decorations: [],
  destinations: [
    { at: { col: 0, row: 0 }, icon: "map-icon-zone", id: "first", stages: ["one", "two"] },
    { at: { col: 10, row: 0 }, icon: "map-icon-zone", id: "second", stages: ["three", "four"] },
  ],
  edges: IDS.slice(1).map((to, index) => ({ built: true, from: IDS[index]!, to })),
  finish: "four",
  nodes: IDS.map((id) => ({ at: { col: 0, row: 0 }, id, kind: "zone", zone: id })),
  start: "one",
};
export {
  MAP as DESTINATION_FIXTURE,
  PLANS as DESTINATION_PLAN_RECORD,
  AVAILABLE as DESTINATION_PLANS,
};
