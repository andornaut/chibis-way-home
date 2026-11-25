import { describe, expect, it } from "vitest";

import type { ZonePlan } from "../data/types/index.ts";
import { middleChunkIds } from "./stagePlans.ts";

describe("a plan's middle chunks", () => {
  it("takes each area's chunks but its first and last as the middle", () => {
    const placed = (ids: string[]) => ids.map((chunk, col) => ({ chunk, col, cols: 1 }));
    const plan = {
      areaOrder: ["lower", "upper"],
      areas: {
        lower: { chunks: placed(["start", "a", "b", "finish"]) },
        upper: { chunks: placed(["cap", "b", "c", "cap"]) },
      },
    } as unknown as ZonePlan;
    expect(middleChunkIds(plan)).toEqual(["a", "b", "c"]);
  });
});
