import { START_SCREEN } from "../../data/layout.ts";

export const TOP_BAR_CENTRE_Y = START_SCREEN.navHeight / 2;

export function topBarFaceY(bottomLip: number, height: number): number {
  return TOP_BAR_CENTRE_Y - (height - bottomLip) / 2;
}

// The top of a side-tall disc centred on the top section, on a whole pixel with the spare pixel
// of an odd side below.
export function topBarDiscY(side: number): number {
  return Math.floor(TOP_BAR_CENTRE_Y - side / 2);
}
