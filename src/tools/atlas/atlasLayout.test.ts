import { type AtlasItem, type AtlasPolicy, packAtlas } from "@andornaut/art-kit/atlasLayout";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { layoutAtlas, type PackItem } from "./atlasLayout";

vi.mock("@andornaut/art-kit/atlasLayout", () => ({ packAtlas: vi.fn() }));

const pack = vi.mocked(packAtlas<PackItem>);
beforeEach(() => {
  pack.mockReset();
});

function policyFor(
  items: readonly PackItem[],
): [AtlasPolicy<PackItem>, readonly AtlasItem<PackItem>[]] {
  pack.mockReturnValue({ pages: [], width: 2048 });
  layoutAtlas(items);
  return pack.mock.calls[0]!;
}

describe("game atlas packing adapter", () => {
  it("passes whole PNG rectangles with the game's page widths, maximum and extrusion", () => {
    const images = [{ height: 24, key: "portrait", width: 48 }];
    const [policy, subjects] = policyFor(images);
    expect(policy).toMatchObject({ extrude: 1, maxSize: 2048, widths: [256, 512, 1024, 2048] });
    expect(subjects).toEqual([{ rectangles: [{ height: 24, width: 48 }], value: images[0] }]);
  });

  it.each([
    {
      after: { height: 8, key: "a", width: 16 },
      before: { height: 16, key: "z", width: 8 },
      name: "height",
    },
    {
      after: { height: 8, key: "a", width: 8 },
      before: { height: 8, key: "z", width: 16 },
      name: "width",
    },
    {
      after: { height: 8, key: "z", width: 8 },
      before: { height: 8, key: "a", width: 8 },
      name: "key",
    },
  ])("prioritizes $name in the comparator supplied to the shared solver", ({ after, before }) => {
    const [policy, subjects] = policyFor([before, after]);
    expect(policy.compare(subjects[0]!, subjects[1]!)).toBeLessThan(0);
    expect(policy.compare(subjects[1]!, subjects[0]!)).toBeGreaterThan(0);
  });

  it("normalizes returned whole-image placements and applies the requested smaller page limit", () => {
    const images = [
      { height: 100, key: "b", width: 100 },
      { height: 22, key: "c", width: 22 },
      { height: 100, key: "a", width: 100 },
    ];
    pack.mockImplementation((_policy, subjects) => ({
      pages: [
        { height: 102, placed: [{ at: [{ x: 1, y: 1 }], item: subjects[2]! }], width: 128 },
        {
          height: 102,
          placed: [
            { at: [{ x: 1, y: 1 }], item: subjects[0]! },
            { at: [{ x: 103, y: 1 }], item: subjects[1]! },
          ],
          width: 128,
        },
      ],
      width: 128,
    }));
    expect(layoutAtlas(images, 128)).toEqual({
      pages: [
        { height: 102, width: 128 },
        { height: 102, width: 128 },
      ],
      placements: [
        { key: "a", page: 0, x: 1, y: 1 },
        { key: "b", page: 1, x: 1, y: 1 },
        { key: "c", page: 1, x: 103, y: 1 },
      ],
    });
    expect(pack.mock.calls[0]![0]).toMatchObject({ extrude: 1, maxSize: 128, widths: [128] });
  });

  it("names an oversized game image when the shared solver rejects the page", () => {
    pack.mockReturnValue(undefined);
    expect(() =>
      layoutAtlas(
        [
          { height: 24, key: "item-0", width: 24 },
          { height: 24, key: "item-1", width: 200 },
        ],
        128,
      ),
    ).toThrow("item-1");
  });
});
