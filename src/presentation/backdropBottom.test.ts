import { expect, it } from "vitest";

import { backdropBottomRect } from "./backdropBottom";

it.each([
  {
    expected: { height: 102, width: 720, x: 7200, y: 498 },
    name: "raised camera",
    view: { height: 360, y: 240 },
  },
  { expected: undefined, name: "zoomed camera", view: { height: 180, y: 240 } },
  {
    expected: { height: 360, width: 720, x: 7200, y: 600 },
    name: "quad above view",
    view: { height: 360, y: 600 },
  },
])("fills only the visible region below the native quad: $name", ({ expected, view }) => {
  expect(backdropBottomRect(view, { height: 600, width: 720, x: 7200, y: -102 })).toEqual(expected);
});
