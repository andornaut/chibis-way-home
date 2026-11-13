import { readFileSync } from "node:fs";

import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";

import palette from "../../../public/art/palette.json" with { type: "json" };
import secondary from "../../../public/art/sprites/ui-button.json" with { type: "json" };
import primary from "../../../public/art/sprites/ui-button-primary.json" with { type: "json" };
import { buttonFace, centredLabel } from "./buttonLabel.ts";

const button = { height: 28, width: 72, x: 452, y: 198 };

describe("centredLabel", () => {
  it.each([
    { expected: { labelX: 468 }, ink: 40, mark: undefined, name: "an even label" },
    {
      expected: { labelX: 468.5 },
      ink: 39,
      mark: undefined,
      name: "an odd label at a fractional origin",
    },
    { expected: { labelX: 452 }, ink: 72, mark: undefined, name: "a label as wide as the button" },
    {
      expected: { labelX: 473.5, markX: 462.5 },
      ink: 40,
      mark: { gap: 6, width: 5 },
      name: "a label with a mark before it",
    },
  ])("places $name", ({ expected, ink, mark }) => {
    expect(centredLabel(button, ink, mark)).toEqual(expected);
  });
});

it("uses the actual native face pixels for primary, secondary and flat disabled content bounds", () => {
  for (const [name, sheet, normalColour] of [
    ["ui-button", secondary, "grey"],
    ["ui-button-primary", primary, "dslate"],
  ] as const) {
    const png = PNG.sync.read(
      readFileSync(new URL(`../../../public/art/sprites/${name}.png`, import.meta.url)),
    );
    for (const state of ["normal", "pressed", "disabled"] as const) {
      const tag = sheet.meta.frameTags.find(({ name }) => name === state)!;
      const frame = Object.values(sheet.frames)[tag.from]!.frame;
      const colour = palette.colours[state === "disabled" ? "lgrey" : normalColour];
      const rgb = [1, 3, 5].map((index) => Number.parseInt(colour.slice(index, index + 2), 16));
      const occupied: { x: number; y: number }[] = [];
      for (let y = 0; y < frame.h; y++) {
        for (let x = 0; x < frame.w; x++) {
          const index = ((frame.y + y) * png.width + frame.x + x) * 4;
          if (
            png.data[index + 3] &&
            rgb.every((value, channel) => png.data[index + channel] === value)
          ) {
            occupied.push({ x, y });
          }
        }
      }
      const top = Math.min(...occupied.map(({ y }) => y));
      const bottom = Math.max(...occupied.map(({ y }) => y)) + 1;
      expect(buttonFace(state, { height: frame.h, width: frame.w, x: 0, y: 0 })).toMatchObject({
        height: bottom - top,
        y: top,
      });
    }
  }
});
