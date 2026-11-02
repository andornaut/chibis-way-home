import { animationKey } from "@andornaut/game-kit/art/aseprite";
import type { GameObjects, Scene } from "phaser";

import type { Point, SkillId } from "../data/types";
import { SKILL_ART, SKILL_BUTTON, SKILL_SELECTION, skillButton } from "../layout/skillHud";
import { paletteColour } from "./cardParts";

// Reuse the native disc while replacing its baked mark inside the navy face.
export function drawSkillButton(scene: Scene, at: Point, skill: SkillId) {
  const layout = skillButton(at);
  const disc = scene.add
    .sprite(layout.disc.x, layout.disc.y, "ui-pause")
    .setOrigin(0)
    .play(animationKey("ui-pause", "rest"));
  const face = scene.add
    .rectangle(
      layout.glyph.x,
      layout.glyph.y,
      SKILL_BUTTON.glyph,
      SKILL_BUTTON.glyph,
      paletteColour(scene, "navy"),
    )
    .setOrigin(0);
  const glyph = scene.add.sprite(layout.glyph.x, layout.glyph.y, SKILL_ART[skill]).setOrigin(0);
  const marker = SKILL_SELECTION;
  const outline = scene.add
    .rectangle(
      layout.disc.x + marker.bar.x - marker.outline,
      layout.disc.y + marker.bar.y - marker.outline,
      marker.bar.width + 2 * marker.outline,
      marker.bar.height + 2 * marker.outline,
      paletteColour(scene, "navy"),
    )
    .setOrigin(0)
    .setVisible(false);
  const bar = scene.add
    .rectangle(
      layout.disc.x + marker.bar.x,
      layout.disc.y + marker.bar.y,
      marker.bar.width,
      marker.bar.height,
      paletteColour(scene, marker.colour),
    )
    .setOrigin(0)
    .setVisible(false);
  let selected = false;
  let shown = true;
  let state: boolean | undefined;
  const objects: GameObjects.GameObject[] = [disc, face, glyph, outline, bar];
  return {
    objects,
    place(at: Point) {
      const position = skillButton(at);
      disc.setPosition(position.disc.x, position.disc.y);
      face.setPosition(position.glyph.x, position.glyph.y);
      glyph.setPosition(position.glyph.x, position.glyph.y);
      outline.setPosition(
        position.disc.x + marker.bar.x - marker.outline,
        position.disc.y + marker.bar.y - marker.outline,
      );
      bar.setPosition(position.disc.x + marker.bar.x, position.disc.y + marker.bar.y);
    },
    ready(ready: boolean) {
      if (ready !== state) {
        glyph.play(animationKey(SKILL_ART[skill], ready ? "ready" : "muted"));
        state = ready;
      }
    },
    selected(value: boolean) {
      selected = value;
      outline.setVisible(shown && selected);
      bar.setVisible(shown && selected);
    },
    visible(visible: boolean) {
      shown = visible;
      outline.setVisible(visible && selected);
      bar.setVisible(visible && selected);
      disc.setVisible(visible);
      face.setVisible(visible);
      glyph.setVisible(visible);
    },
  };
}
