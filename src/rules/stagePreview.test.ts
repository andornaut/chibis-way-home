import { describe, expect, it } from "vitest";

import { askedStagePreview, stagePreviewScroll } from "./stagePreview";

const keys = ["street", "climb-to-apartment"];
const request = "?stagePreview=street&assembly=0&seed=42&previewX=800&previewY=240";

describe("deterministic screenshot requests", () => {
  it("requires an explicit screenshot flag and preserves fixed seeds and camera coordinates", () => {
    expect(askedStagePreview(keys, "?zone=street&assembly=1&seed=42")).toBeUndefined();
    expect(askedStagePreview(keys, request)).toEqual({
      assemblySeed: 0,
      key: "street",
      motionSeed: 42,
      scroll: { x: 800, y: 240 },
    });
    expect(askedStagePreview(keys, `${request}&previewArea=lobby`)?.area).toBe("lobby");
  });
  it.each([
    request.replace("&assembly=0", ""),
    request.replace("seed=42", "seed=-1"),
    request.replace("previewX=800", "previewX=NaN"),
    request.replace("stagePreview=street", "stagePreview=missing"),
  ])("rejects incomplete or invalid screenshot requests: %s", (search) => {
    expect(() => askedStagePreview(keys, search)).toThrow("Invalid stage preview request");
  });
  it.each([
    {
      area: { height: 720, width: 2000 },
      expected: { x: 1280, y: 360 },
      scroll: { x: 1800, y: 500 },
    },
    { area: { height: 300, width: 600 }, expected: { x: 0, y: 0 }, scroll: { x: 100, y: 100 } },
  ])("clamps the camera to the selected area's actual bounds", ({ area, expected, scroll }) => {
    expect(stagePreviewScroll({ height: 360, width: 720 }, area, scroll)).toEqual(expected);
  });
});
