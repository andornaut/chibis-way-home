import { SKILL_BUTTON } from "../layout/index.ts";
import type { TouchChromeLayer } from "./touchChrome.ts";

export function skillChromeLayers(face: number): readonly TouchChromeLayer[] {
  const centre = { x: SKILL_BUTTON.target / 2, y: SKILL_BUTTON.target / 2 };
  return [{ centre, colour: face, kind: "disc", radius: SKILL_BUTTON.disc / 2 }];
}
