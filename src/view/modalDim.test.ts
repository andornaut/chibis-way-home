import { describe, expect, it } from "vitest";

import palette from "../../public/art/palette.json";
import { dimColour } from "./dim";
import { modalColour } from "./modalDim";

const rgb = (hex: string) => Number.parseInt(hex.slice(1), 16);

describe("Duck modal palette adapter", () => {
  it("darkens a frozen scene more than the unchanged ambient title treatment", () => {
    const modal = modalColour(palette);
    const ambient = dimColour(palette);
    expect(modal(rgb(palette.colours.white))).toBe(rgb(palette.colours.slate));
    expect(ambient(rgb(palette.colours.white))).toBe(rgb(palette.colours.grey));
    expect(modal(rgb(palette.colours.ink))).toBe(rgb(palette.colours.ink));
  });
});
