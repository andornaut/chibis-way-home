import type { ZoneMap } from "../data/types/index.ts";
import { askedRecipe, askedSeed } from "./pageParams.ts";
import { type StageRequest, stageTarget } from "./stagePlans.ts";
import { askedStagePreview, type StagePreview } from "./stagePreview.ts";

// What a stage entry is read against.
export interface StageEntryContext {
  // A fresh whole number in [0, SEED_LIMIT) each call. Rules stay seeded, so the caller supplies
  // the entropy.
  readonly entropy: () => number;
  readonly map: ZoneMap;
  // The middle chunk ids a fresh entry of a map stage avoids.
  readonly recent: (stage: string) => readonly string[];
  // The recipe keys ?zone= and ?stagePreview= may name.
  readonly recipes: readonly string[];
}

// What the zone scene starts with: the start screen's backdrop, or the map node to play.
export interface StageStart {
  readonly backdrop?: boolean;
  readonly node?: string;
}

// How a stage is entered: the start screen's backdrop, a map node, the opening stage outside the
// map, a frozen preview or a ?zone= trial.
export type StageMode = "backdrop" | "map" | "opening" | "preview" | "trial";

// One stage entry: its mode, the stage to plan, and what the page fixes. record names the map
// stage whose destination remembers the plan's middle chunks, on a map entry alone.
export interface StageEntry {
  readonly mode: StageMode;
  readonly motionSeed?: number;
  readonly preview?: StagePreview;
  readonly record?: string;
  readonly request: StageRequest;
  readonly trial?: string;
}

// The stage entry the page address and the scene's start data ask for. A preview comes first,
// then the backdrop, a map node, the recipe ?zone=<key> names, or else the opening stage. The
// assembly seed is the preview's, or ?assembly=<n>, or else drawn from entropy; motionSeed is the
// preview's or ?seed=<n>, absent when the page fixes none. Only a map entry avoids its recent
// chunks and records its own. Throws on an invalid preview request, an unknown ?zone= key or a
// malformed ?assembly= or ?seed=.
export function stageRequest(
  context: StageEntryContext,
  search: string,
  start: StageStart,
): StageEntry {
  const { map, recipes } = context;
  const preview = askedStagePreview(
    [
      ...map.nodes
        .filter((node) => node.kind === "zone" && node.zone !== undefined)
        .map((node) => node.id),
      ...recipes,
    ],
    search,
  );
  const trial = askedRecipe(recipes, search);
  const assembly = askedSeed("assembly", search);
  const motion = askedSeed("seed", search);
  const motionSeed = preview?.motionSeed ?? motion;
  const seed = preview?.assemblySeed ?? assembly ?? context.entropy();
  const asked = {
    ...(motionSeed !== undefined && { motionSeed }),
    ...(preview && { preview }),
    ...(trial !== undefined && { trial }),
  };
  const entry = (mode: StageMode, request: Omit<StageRequest, "seed">): StageEntry => ({
    ...asked,
    mode,
    request: { ...request, seed },
  });
  if (preview) {
    return entry("preview", { avoid: [], target: stageTarget(map, preview.key) });
  }
  if (start.backdrop === true) {
    return entry("backdrop", { avoid: [], target: { node: map.start } });
  }
  if (start.node !== undefined) {
    return {
      ...entry("map", { avoid: context.recent(start.node), target: { node: start.node } }),
      record: start.node,
    };
  }
  return trial === undefined
    ? entry("opening", { avoid: [], target: { node: map.start } })
    : entry("trial", { avoid: [], target: { recipe: trial } });
}
