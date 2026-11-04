import { modalDimmer } from "@andornaut/game-kit/view/modalDim";

import type { Palette } from "./dim";

// Modals share one strength while the title screen keeps its separate ambient treatment.
export function modalColour(palette: Palette): (colour: number) => number {
  const oneStep = new Map(
    Object.entries(palette.darker).map(([from, to]) => [
      Number.parseInt(from.slice(1), 16),
      Number.parseInt(to.slice(1), 16),
    ]),
  );
  return modalDimmer(oneStep);
}
