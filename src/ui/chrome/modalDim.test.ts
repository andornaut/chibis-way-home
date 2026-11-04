import { describe, expect, it } from "vitest";

import palette from "../../../public/art/palette.json";
import { modalColour } from "./modalDim";

const rgb = (hex: string) => Number.parseInt(hex.slice(1), 16);

describe("Duck modal palette adapter", () => {
  it("darkens a frozen scene along its ramp and leaves ink unchanged", () => {
    const modal = modalColour(palette);
    expect(modal(rgb(palette.colours.white))).toBe(rgb(palette.colours.slate));
    expect(modal(rgb(palette.colours.ink))).toBe(rgb(palette.colours.ink));
  });
});
