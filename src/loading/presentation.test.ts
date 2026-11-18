import { expect, it } from "vitest";

import palette from "../../public/art/palette.json" with { type: "json" };
import { LOADING_FAILURE_PRESENTATION } from "../data/layout.ts";
import { loadingFailurePresentation, loadingUnit } from "./presentation.ts";

it("shares the existing landscape CSS fit before a game UI layer exists", () => {
  expect(loadingUnit({ offsetHeight: 360, offsetWidth: 360 })).toBe(0.5);
  expect(loadingUnit({ offsetHeight: 180, offsetWidth: 720 })).toBe(0.5);
  expect(loadingUnit({ offsetHeight: 0, offsetWidth: 720 })).toBe(0);
});

it("keeps approved CSS panel and text metrics while scaling only the logical action", () => {
  const small = loadingFailurePresentation(0.5);
  const large = loadingFailurePresentation(2);
  expect(small.panel).toEqual(LOADING_FAILURE_PRESENTATION.panel);
  expect(large.panel).toEqual(small.panel);
  expect(small.text).toEqual(LOADING_FAILURE_PRESENTATION.text);
  expect(large.text).toEqual(small.text);
  expect(small.action).toEqual({
    borderWidthPx: 0.5,
    heightPx: 24,
    highlightHeightPx: 0.5,
    paddingBottomPx: 2,
    paddingXPx: 6,
    shadeHeightPx: 2,
    widthPx: 64,
  });
  expect(large.action).toEqual({
    borderWidthPx: 2,
    heightPx: 96,
    highlightHeightPx: 2,
    paddingBottomPx: 8,
    paddingXPx: 24,
    shadeHeightPx: 8,
    widthPx: 256,
  });
  expect(small.palette).toEqual({
    action: palette.colours.dslate,
    actionText: palette.colours.white,
    border: palette.colours.ink,
    highlight: palette.colours.slate,
    lip: palette.colours.navy,
    panel: palette.colours.cream,
    shade: palette.colours.navy,
    shadow: palette.colours.ink,
    text: palette.colours.plum,
  });
});
