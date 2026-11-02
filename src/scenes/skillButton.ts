import { animationKey } from "@andornaut/game-kit/art/aseprite";
import { type GameObjects, type Scene, TintModes } from "phaser";

import type { Point, SkillId } from "../data/types";
import { SKILL_ART, SKILL_BUTTON, skillButton } from "../layout/skillHud";
import { paletteColour } from "./cardParts";

const DISC_CENTRE = Math.floor(SKILL_BUTTON.disc / 2);

function fillDisc(graphics: GameObjects.Graphics, colour: number, radius: number) {
  graphics.fillStyle(colour, 1);
  const squared = (radius + 0.5) ** 2;
  for (let y = -radius; y <= radius; y++) {
    let left = -radius;
    while (left * left + y * y > squared) {
      left++;
    }
    graphics.fillRect(DISC_CENTRE + left, DISC_CENTRE + y, 1 - 2 * left, 1);
  }
}

// Keep the native cream disc and replace its baked pause bars with an opaque pixel face.
export function drawSkillButton(scene: Scene, at: Point, skill: SkillId) {
  const layout = skillButton(at);
  const ring = scene.add.graphics().setPosition(layout.disc.x, layout.disc.y).setVisible(false);
  fillDisc(ring, paletteColour(scene, "ink"), 21);
  fillDisc(ring, paletteColour(scene, "yellow"), 20);
  fillDisc(ring, paletteColour(scene, "ink"), 18);
  const disc = scene.add
    .sprite(layout.disc.x, layout.disc.y, "ui-pause")
    .setOrigin(0)
    .play(animationKey("ui-pause", "rest"));
  const face = scene.add.graphics().setPosition(layout.disc.x, layout.disc.y);
  const glyph = scene.add.sprite(layout.glyph.x, layout.glyph.y, SKILL_ART[skill]).setOrigin(0);
  let selected = false;
  let shown = true;
  let state: boolean | undefined;
  const drawGlyph = (ready: boolean) => {
    if (ready !== state) {
      face.clear();
      fillDisc(face, paletteColour(scene, ready ? "yellow" : "navy"), 13);
      glyph.play(animationKey(SKILL_ART[skill], ready ? "ready" : "muted"));
      if (ready) {
        glyph.setTint(paletteColour(scene, "ink")).setTintMode(TintModes.FILL);
      } else {
        glyph.clearTint();
      }
      state = ready;
    }
  };
  drawGlyph(false);
  const objects: GameObjects.GameObject[] = [ring, disc, face, glyph];
  return {
    objects,
    place(at: Point) {
      const position = skillButton(at);
      ring.setPosition(position.disc.x, position.disc.y);
      disc.setPosition(position.disc.x, position.disc.y);
      face.setPosition(position.disc.x, position.disc.y);
      glyph.setPosition(position.glyph.x, position.glyph.y);
    },
    ready(value: boolean) {
      drawGlyph(value);
    },
    selected(value: boolean) {
      selected = value;
      ring.setVisible(shown && selected);
    },
    visible(visible: boolean) {
      shown = visible;
      ring.setVisible(visible && selected);
      disc.setVisible(visible);
      face.setVisible(visible);
      glyph.setVisible(visible);
    },
  };
}
