import { describe, expect, it, vi } from "vitest";

import { ZONE_MAP } from "../data/map.ts";
import { RECIPES } from "../data/zones.ts";
import { stageRequest } from "./stageRequest.ts";

const KEYS = Object.keys(RECIPES);
// A recipe key that names no map node.
const TRIAL = KEYS.find((key) => ZONE_MAP.nodes.every((node) => node.id !== key))!;
const NODE = ZONE_MAP.nodes.find(
  (node) => node.kind === "zone" && node.zone !== undefined && node.id !== ZONE_MAP.start,
)!.id;
const DRAWN = 4242;
const RECENT = ["recent-a", "recent-b"];
const OPENING = { node: ZONE_MAP.start };

// A context whose entropy and recent chunks are recorded.
function context() {
  return {
    entropy: vi.fn(() => DRAWN),
    map: ZONE_MAP,
    recent: vi.fn((): readonly string[] => RECENT),
    recipes: KEYS,
  };
}

describe("the stage entry a page address and start data ask for", () => {
  it("enters a map node avoiding its recent chunks and recording its own", () => {
    const asked = context();
    expect(stageRequest(asked, "", { node: NODE })).toEqual({
      mode: "map",
      record: NODE,
      request: { avoid: RECENT, seed: DRAWN, target: { node: NODE } },
    });
    expect(asked.recent).toHaveBeenCalledExactlyOnceWith(NODE);
    expect(asked.entropy).toHaveBeenCalledOnce();
  });

  it.each([
    ["the backdrop", "", { backdrop: true, node: NODE }, "backdrop", OPENING],
    ["the opening stage", "", {}, "opening", OPENING],
    ["a trial", `?zone=${TRIAL}`, {}, "trial", { recipe: TRIAL }],
  ] as const)("enters %s with nothing avoided or recorded", (_, search, start, mode, target) => {
    const asked = context();
    const entry = stageRequest(asked, search, start);
    expect(entry).toEqual({
      mode,
      request: { avoid: [], seed: DRAWN, target },
      ...(mode === "trial" && { trial: TRIAL }),
    });
    expect(asked.recent).not.toHaveBeenCalled();
  });

  it("plays a map node over the recipe the page names", () => {
    expect(stageRequest(context(), `?zone=${TRIAL}`, { node: NODE })).toMatchObject({
      mode: "map",
      request: { target: { node: NODE } },
      trial: TRIAL,
    });
  });

  it("takes the seeds the page fixes and draws no entropy for the assembly", () => {
    const asked = context();
    expect(stageRequest(asked, "?assembly=7&seed=9", { node: NODE })).toMatchObject({
      motionSeed: 9,
      request: { seed: 7 },
    });
    expect(asked.entropy).not.toHaveBeenCalled();
    expect(stageRequest(asked, "?seed=9", {}).request.seed).toBe(DRAWN);
  });

  it.each([
    ["a map stage", NODE, { node: NODE }],
    ["a recipe key", TRIAL, { recipe: TRIAL }],
  ])("freezes a preview of %s on the page's seeds before any other entry", (_, key, target) => {
    const asked = context();
    const search = `?stagePreview=${key}&assembly=5&seed=6&previewX=0&previewY=0`;
    const preview = { assemblySeed: 5, key, motionSeed: 6, scroll: { x: 0, y: 0 } };
    expect(stageRequest(asked, search, { backdrop: true, node: NODE })).toEqual({
      mode: "preview",
      motionSeed: 6,
      preview,
      request: { avoid: [], seed: 5, target },
    });
    expect(asked.entropy).not.toHaveBeenCalled();
    expect(asked.recent).not.toHaveBeenCalled();
  });

  it.each([
    ["?zone=nowhere", "Unknown ?zone=nowhere"],
    ["?assembly=-1", "Invalid ?assembly=-1"],
    ["?seed=1.5", "Invalid ?seed=1.5"],
    [`?stagePreview=${TRIAL}`, "Invalid stage preview request"],
  ])("refuses %s", (search, message) => {
    const asked = context();
    expect(() => stageRequest(asked, search, { node: NODE })).toThrow(message);
    expect(asked.entropy).not.toHaveBeenCalled();
  });
});
