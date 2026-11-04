import { describe, expect, it } from "vitest";

import { mapBounded } from "./mapBounded";

describe("bounded concurrent map", () => {
  it("keeps at most the limit pending and resolves in the items' order", async () => {
    let pending = 0;
    let peak = 0;
    const items = Array.from({ length: 10 }, (_, index) => index);
    const results = await mapBounded(
      3,
      async (item: number) => {
        pending += 1;
        peak = Math.max(peak, pending);
        await new Promise((resolve) => {
          setTimeout(resolve, (10 - item) % 4);
        });
        pending -= 1;
        return item * 2;
      },
      items,
    );
    expect(peak).toBe(3);
    expect(results).toEqual(items.map((item) => item * 2));
  });

  it("rejects with the mapper's error", async () => {
    const failure = new Error("unreadable");
    await expect(
      mapBounded(
        2,
        async (item: number) => {
          if (item === 1) {
            throw failure;
          }
          return item;
        },
        [0, 1, 2],
      ),
    ).rejects.toBe(failure);
  });
});
