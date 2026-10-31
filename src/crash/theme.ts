import type { CrashColours } from "@andornaut/game-kit/crash/crashScreen";

import palette from "../../public/art/palette.json";
import bird from "../../public/art/sprites/bird.json";

const { dslate, ink, lgrey, navy, white, yellow } = palette.colours;

export const CRASH_COLOURS: CrashColours = {
  background: navy,
  buttonFace: dslate,
  buttonLip: navy,
  ink,
  text: white,
};

// The HTML fallback uses the same held pose as the game, without needing its renderer.
export function installCrashTheme(style: Pick<CSSStyleDeclaration, "setProperty">): void {
  const death = bird.meta.frameTags.find((tag) => tag.name === "death")!;
  const { frame } = Object.values(bird.frames)[death.to]!;
  const scale = 2;
  for (const [name, value] of Object.entries({
    "bird-height": `${frame.h * scale}px`,
    "bird-position": `${-frame.x * scale}px ${-frame.y * scale}px`,
    "bird-sheet-size": `${bird.meta.size.w * scale}px ${bird.meta.size.h * scale}px`,
    "bird-width": `${frame.w * scale}px`,
    "card-face": lgrey,
    focus: yellow,
  })) {
    style.setProperty(`--chibi-crash-${name}`, value);
  }
}
