import { animationKey } from "@andornaut/game-kit/art/aseprite";
import { type GameObjects, type Scene, TintModes } from "phaser";

import type { Point, SkillId } from "../data/types";
import {
  SKILL_ART,
  SKILL_BUTTON,
  skillButton,
  skillChromeLayers,
  type TouchChromeLayer,
} from "../ui";
import { paletteColour } from "./cardParts";
import { createChromeTexture } from "./touchChrome";

const SKILL_CHROME_KEY = "skill-button-chrome";

function chromeFrame(selected: boolean, ready: boolean): string {
  return `${selected ? "selected" : "unselected"}-${ready ? "ready" : "muted"}`;
}

// One game-lifetime sheet of the four selected and ready states.
function chromeTexture(scene: Scene): string {
  if (!scene.textures.exists(SKILL_CHROME_KEY)) {
    const ink = paletteColour(scene, "ink");
    const frames = new Map<string, readonly TouchChromeLayer[]>();
    for (const selected of [false, true]) {
      for (const ready of [false, true]) {
        const face = paletteColour(scene, ready ? "yellow" : "navy");
        frames.set(chromeFrame(selected, ready), skillChromeLayers({ face, ink }, selected));
      }
    }
    createChromeTexture(scene, SKILL_CHROME_KEY, SKILL_BUTTON.target, frames);
  }
  return SKILL_CHROME_KEY;
}

export function drawSkillButton(scene: Scene, at: Point, skill: SkillId) {
  const layout = skillButton(at);
  const chrome = scene.add
    .image(at.x, at.y, chromeTexture(scene), chromeFrame(false, false))
    .setOrigin(0)
    .setDisplaySize(SKILL_BUTTON.target, SKILL_BUTTON.target);
  const glyph = scene.add.sprite(layout.glyph.x, layout.glyph.y, SKILL_ART[skill]).setOrigin(0);
  let selected = false;
  let state: boolean | undefined;
  const drawChrome = () => chrome.setFrame(chromeFrame(selected, state === true));
  const drawGlyph = (ready: boolean) => {
    if (ready !== state) {
      glyph.play(animationKey(SKILL_ART[skill], ready ? "ready" : "muted"));
      if (ready) {
        glyph.setTint(paletteColour(scene, "ink")).setTintMode(TintModes.FILL);
      } else {
        glyph.clearTint();
      }
      state = ready;
      drawChrome();
    }
  };
  drawGlyph(false);
  const objects: GameObjects.GameObject[] = [chrome, glyph];
  return {
    objects,
    place(at: Point) {
      const position = skillButton(at);
      chrome.setPosition(at.x, at.y);
      glyph.setPosition(position.glyph.x, position.glyph.y);
    },
    ready(value: boolean) {
      drawGlyph(value);
    },
    selected(value: boolean) {
      if (selected !== value) {
        selected = value;
        drawChrome();
      }
    },
    visible(visible: boolean) {
      chrome.setVisible(visible);
      glyph.setVisible(visible);
    },
  };
}
