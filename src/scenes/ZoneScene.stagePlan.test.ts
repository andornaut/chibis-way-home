import { afterEach, expect, it, vi } from "vitest";

import { ZONE_MAP } from "../data/map.ts";
import { RECIPES } from "../data/zones.ts";
import { planStage } from "../rules/stage/stagePlans.ts";
import { STAGE_CONTEXT } from "../rules/stage/zonePlans.ts";

const save = vi.hoisted(() => ({
  recentStageChunks: vi.fn((): readonly (readonly string[])[] => []),
  recordStageChunks: vi.fn(),
}));
vi.mock("phaser", () => ({ Input: {}, Scale: {}, Scene: class {}, Scenes: {} }));
vi.mock("../ui/input/frameTurn.ts", () => ({ FRAME_TURN: {} }));
vi.mock("./save.ts", () => save);
vi.mock("../progress/save/runSummary.ts", () => ({ wholeRunSummary: () => ({}) }));

import { type ZoneData, ZoneScene } from "./ZoneScene.ts";

const SEED = 0;
const NODE = ZONE_MAP.start;

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

// Starts the stage the page address and data ask for, with loading the plan recorded.
function start(search: string, data: ZoneData) {
  vi.stubGlobal("window", { location: { search } });
  const loadPlan = vi.fn();
  const scene = Object.assign(new ZoneScene(), { loadPlan }) as unknown as {
    init(data: ZoneData): void;
    startStage(): void;
  };
  scene.init(data);
  scene.startStage();
  return loadPlan;
}

it("plans a map entry without its saved recent chunks, then records its own middle chunks", () => {
  // A recipe that still assembles without its own middle chunks.
  const stage = ZONE_MAP.nodes.find((node) => {
    if (node.kind !== "zone" || node.zone === undefined) {
      return false;
    }
    const target = { node: node.id };
    const { middle } = planStage(STAGE_CONTEXT, { avoid: [], seed: SEED, target });
    const avoiding = planStage(STAGE_CONTEXT, { avoid: [middle], seed: SEED, target });
    return avoiding.middle.join() !== middle.join();
  })!.id;
  const target = { node: stage };
  const recent = [planStage(STAGE_CONTEXT, { avoid: [], seed: SEED, target }).middle];
  save.recentStageChunks.mockReturnValue(recent);
  const expected = planStage(STAGE_CONTEXT, { avoid: recent, seed: SEED, target });
  const loadPlan = start(`?assembly=${SEED}`, { node: stage });
  expect(save.recentStageChunks).toHaveBeenCalledExactlyOnceWith(stage);
  expect(loadPlan).toHaveBeenCalledExactlyOnceWith(expected.plan);
  expect(save.recordStageChunks).toHaveBeenCalledExactlyOnceWith(stage, expected.middle);
  expect(loadPlan.mock.invocationCallOrder[0]).toBeLessThan(
    save.recordStageChunks.mock.invocationCallOrder[0]!,
  );
}, 60_000);

it.each([
  ["the backdrop", "", { backdrop: true, node: NODE }, { node: NODE }],
  ["a trial", `?zone=${Object.keys(RECIPES)[0]!}`, {}, { recipe: Object.keys(RECIPES)[0]! }],
])("plans %s with no recent chunks read or recorded", (_, search, data, target) => {
  const loadPlan = start(`${search}${search ? "&" : "?"}assembly=${SEED}`, data);
  expect(loadPlan).toHaveBeenCalledExactlyOnceWith(
    planStage(STAGE_CONTEXT, { avoid: [], seed: SEED, target }).plan,
  );
  expect(save.recentStageChunks).not.toHaveBeenCalled();
  expect(save.recordStageChunks).not.toHaveBeenCalled();
});
