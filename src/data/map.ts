import { TILE } from "./screen.ts";
import type { MapDestination, ZoneMap } from "./types/index.ts";
import { RECIPES } from "./zones.ts";

// V1's ordered destinations are the source of stage order and marker positions. The map starts
// at the first destination's first stage and finishes at the last destination's last stage.
const DESTINATIONS: readonly [MapDestination, ...MapDestination[]] = [
  {
    at: { col: 10, row: 7 },
    icon: "map-icon-blue-cityscape",
    id: "blue-cityscape",
    stages: ["street", "city-streets", "city-boundary"],
  },
  {
    at: { col: 29, row: 7 },
    icon: "map-icon-industrial",
    id: "industrial",
    stages: ["warehouse-district", "loading-yards", "freight-terminal"],
  },
  {
    at: { col: 48, row: 7 },
    icon: "map-icon-countryside",
    id: "countryside",
    stages: ["farmland", "country-lanes", "river-crossing"],
  },
  {
    at: { col: 48, row: 18 },
    icon: "map-icon-woodland",
    id: "woodland",
    stages: ["forest-paths", "deep-woods", "ravine"],
  },
  {
    at: { col: 29, row: 18 },
    icon: "map-icon-home-city",
    id: "home-city",
    stages: ["city-outskirts", "back-streets", "familiar-neighbourhood"],
  },
  {
    at: { col: 10, row: 18 },
    icon: "map-icon-apartment",
    id: "apartment",
    stages: ["lobby", "restaurant", "pool", "spa", "residential-floors", "penthouse"],
  },
];

const STAGES = DESTINATIONS.flatMap(({ stages }) => stages);
// A catalogue node is playable only when its recipe is implemented.
const BUILT_STAGES: ReadonlySet<string> = new Set(
  STAGES.filter((id) => Object.hasOwn(RECIPES, id)),
);
const REGION_ORIGIN = { x: 60, y: 36 };

// The last item of a non-empty list.
function last<T>(items: readonly [T, ...T[]]): T {
  return items.reduce((_, item) => item);
}

export const MAP_TRAVEL = { speed: 180 } as const;

export const ZONE_MAP: ZoneMap = {
  decorations: DESTINATIONS.map(({ at, id }) => ({
    art: `map-region-${id}`,
    at: {
      x: (at.col + 0.5) * TILE - REGION_ORIGIN.x,
      y: (at.row + 0.5) * TILE - REGION_ORIGIN.y,
    },
  })),
  destinations: DESTINATIONS,
  edges: STAGES.flatMap((from, index) => {
    const to = STAGES[index + 1];
    return to === undefined
      ? []
      : [{ built: BUILT_STAGES.has(from) && BUILT_STAGES.has(to), from, to }];
  }),
  finish: last(last(DESTINATIONS).stages),
  nodes: DESTINATIONS.flatMap(({ at, stages }) =>
    stages.map((id) => ({
      at,
      id,
      kind: "zone" as const,
      ...(BUILT_STAGES.has(id) ? { zone: id } : {}),
    })),
  ),
  start: DESTINATIONS[0].stages[0],
};
