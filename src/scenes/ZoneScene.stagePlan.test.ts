import { afterEach, expect, it, vi } from "vitest";

import { ZONE_MAP } from "../data/map.ts";
import { ROOMS } from "../data/rooms.ts";
import { RECIPES } from "../data/zones.ts";
import type { PreparedStageGift } from "../progress/index.ts";
import { planStage, requirePlanned } from "../rules/stage/stagePlans.ts";
import { STAGE_CONTEXT } from "../rules/stage/zonePlans.ts";

const save = vi.hoisted(() => ({
  commitStageGift: vi.fn(),
  prepareStageGift: vi.fn((): PreparedStageGift | undefined => undefined),
  recentStageChunks: vi.fn((): readonly (readonly string[])[] => []),
  recordStageChunks: vi.fn(),
}));
vi.mock("phaser", () => ({ Input: {}, Scale: {}, Scene: class {}, Scenes: {} }));
vi.mock("../ui/input/frameTurn.ts", () => ({ frameTurn: () => ({}) }));
vi.mock("./save.ts", () => save);
const resolved = vi.hoisted(() => ({ layout: vi.fn((plan: unknown) => plan) }));
vi.mock("../rules/stage/tiles.ts", async (original) => ({
  ...(await original<object>()),
  zoneLayout: (...args: unknown[]) => resolved.layout(args.at(-1)),
}));
vi.mock("../progress/save/runSummary.ts", () => ({ wholeRunSummary: () => ({}) }));

import { type ZoneData, ZoneScene } from "./ZoneScene.ts";

const SEED = 0;
const NODE = ZONE_MAP.start;

afterEach(() => {
  vi.clearAllMocks();
  save.prepareStageGift.mockReset();
  resolved.layout.mockImplementation((plan: unknown) => plan);
  vi.unstubAllGlobals();
});

// Starts the stage the page address and data ask for, with loading the plan recorded.
function start(search: string, data: ZoneData) {
  vi.stubGlobal("window", { location: { search } });
  const loadPlan = vi.fn();
  const scene = Object.assign(new ZoneScene(), {
    cache: {},
    loadPlan,
    manifest: { tilesets: [] },
  }) as unknown as {
    init(data: ZoneData): void;
    startStage(): void;
    isZoneGiftRoom(room: string): boolean;
  };
  scene.init(data);
  scene.startStage();
  return { loadPlan, scene };
}

it("plans a map entry without its saved recent chunks, then records its own middle chunks", () => {
  // A recipe that still assembles without its own middle chunks.
  const stage = ZONE_MAP.nodes.find((node) => {
    if (node.kind !== "zone" || node.zone === undefined) {
      return false;
    }
    const target = { node: node.id };
    const { middle } = requirePlanned(planStage(STAGE_CONTEXT, { avoid: [], seed: SEED, target }));
    const avoiding = requirePlanned(
      planStage(STAGE_CONTEXT, { avoid: [middle], seed: SEED, target }),
    );
    return avoiding.middle.join() !== middle.join();
  })!.id;
  const target = { node: stage };
  const recent = [
    requirePlanned(planStage(STAGE_CONTEXT, { avoid: [], seed: SEED, target })).middle,
  ];
  save.recentStageChunks.mockReturnValue(recent);
  const expected = requirePlanned(planStage(STAGE_CONTEXT, { avoid: recent, seed: SEED, target }));
  const { loadPlan } = start(`?assembly=${SEED}`, { node: stage });
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
  const { loadPlan } = start(`${search}${search ? "&" : "?"}assembly=${SEED}`, data);
  expect(loadPlan).toHaveBeenCalledExactlyOnceWith(
    requirePlanned(planStage(STAGE_CONTEXT, { avoid: [], seed: SEED, target })).plan,
  );
  expect(save.recentStageChunks).not.toHaveBeenCalled();
  expect(save.recordStageChunks).not.toHaveBeenCalled();
});

it.each([null, Object.keys(ROOMS).find((key) => ROOMS[key]!.grant !== undefined)!])(
  "commits gift %s after resolution and before loading movement",
  (giftRoom) => {
    const gift: PreparedStageGift = {
      giftRoom,
      previousVisit: null,
      stage: NODE,
      visit: { seed: 7, zone: ZONE_MAP.destinations[0]!.id },
    };
    save.prepareStageGift.mockReturnValue(gift);
    const { loadPlan, scene } = start(`?assembly=${SEED}`, { node: NODE });
    expect(save.prepareStageGift).toHaveBeenCalledExactlyOnceWith(NODE, expect.any(Number));
    expect(save.commitStageGift).toHaveBeenCalledExactlyOnceWith(gift);
    expect(resolved.layout.mock.invocationCallOrder[0]).toBeLessThan(
      save.commitStageGift.mock.invocationCallOrder[0]!,
    );
    expect(save.commitStageGift.mock.invocationCallOrder[0]).toBeLessThan(
      loadPlan.mock.invocationCallOrder[0]!,
    );
    for (const room of Object.keys(ROOMS)) {
      expect(scene.isZoneGiftRoom(room)).toBe(room === giftRoom);
    }
  },
);

it("leaves gift and recent-chunk saves alone if layout resolution fails", () => {
  save.prepareStageGift.mockReturnValue({
    giftRoom: null,
    previousVisit: null,
    stage: NODE,
    visit: { seed: 7, zone: ZONE_MAP.destinations[0]!.id },
  });
  resolved.layout.mockImplementationOnce(() => {
    throw new Error("resolution failed");
  });
  expect(() => start(`?assembly=${SEED}`, { node: NODE })).toThrow("resolution failed");
  expect(save.commitStageGift).not.toHaveBeenCalled();
  expect(save.recordStageChunks).not.toHaveBeenCalled();
});

it.each([
  ["backdrop", "", { backdrop: true }],
  ["preview", `?stagePreview=${NODE}&seed=7&previewX=0&previewY=0`, {}],
])("does not prepare or commit gifts for a %s", (_, search, data) => {
  start(`${search}${search ? "&" : "?"}assembly=${SEED}`, data);
  expect(save.prepareStageGift).not.toHaveBeenCalled();
  expect(save.commitStageGift).not.toHaveBeenCalled();
});
