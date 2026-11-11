import { SKILL_BUTTON } from "../layout/skillHud";
import type { TouchChromeLayer } from "./touchChrome";

interface SkillChromeColours {
  readonly face: number;
  readonly ink: number;
}

// A skill button's circle in its 48px target: the 33px face, or for the selected skill a 4px
// ink annulus inside the same circle around a 25px face.
export function skillChromeLayers(
  colours: SkillChromeColours,
  selected: boolean,
): readonly TouchChromeLayer[] {
  const centre = { x: SKILL_BUTTON.target / 2, y: SKILL_BUTTON.target / 2 };
  const radius = SKILL_BUTTON.disc / 2;
  return selected
    ? [
        { centre, colour: colours.ink, kind: "disc", radius },
        { centre, colour: colours.face, kind: "disc", radius: radius - 4 },
      ]
    : [{ centre, colour: colours.face, kind: "disc", radius }];
}
