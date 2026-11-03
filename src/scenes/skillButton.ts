import { animationKey } from "@andornaut/game-kit/art/aseprite";
import { clamp01 } from "@andornaut/game-kit/numbers";
import { type GameObjects, type Scene, Textures, TintModes } from "phaser";

import type { Point, SkillId } from "../data/types";
import { SKILL_ART, SKILL_BUTTON, skillButton } from "../layout/skillHud";
import { paletteColour } from "./cardParts";

const CHROME_SCALE = 4;
const CHROME_CENTRE = SKILL_BUTTON.target / 2;
const SELECTED_FACE_RADIUS = SKILL_BUTTON.disc / 2;
const OUTER_RADIUS = SELECTED_FACE_RADIUS + 4;

function chromeTexture(scene: Scene, selected: boolean, ready: boolean): string {
  const face = paletteColour(scene, ready ? "yellow" : "navy");
  const ink = paletteColour(scene, "ink");
  const key = `skill-button-chrome-${selected}-${face}-${ink}`;
  if (scene.textures.exists(key)) {
    return key;
  }
  const size = SKILL_BUTTON.target * CHROME_SCALE;
  const texture = scene.textures.createCanvas(key, size, size);
  if (texture === null) {
    throw new Error(`Cannot create ${key}`);
  }
  const context = texture.getContext();
  const image = context.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const distance = Math.hypot(
        (x + 0.5) / CHROME_SCALE - CHROME_CENTRE,
        (y + 0.5) / CHROME_SCALE - CHROME_CENTRE,
      );
      // Coverage stays local to the circle edges, independently of the renderer's pixel-art mode.
      const faceCoverage = clamp01(
        (selected ? SELECTED_FACE_RADIUS : OUTER_RADIUS) + 0.5 - distance,
      );
      const coverage = clamp01(OUTER_RADIUS + 0.5 - distance);
      if (coverage === 0) {
        continue;
      }
      const offset = 4 * (y * size + x);
      for (const [channel, shift] of [16, 8, 0].entries()) {
        image.data[offset + channel] = Math.round(
          (((face >> shift) & 255) * faceCoverage +
            ((ink >> shift) & 255) * (coverage - faceCoverage)) /
            coverage,
        );
      }
      image.data[offset + 3] = Math.round(255 * coverage);
    }
  }
  context.putImageData(image, 0, 0);
  texture.refresh();
  texture.setFilter(Textures.FilterMode.LINEAR);
  return key;
}

export function drawSkillButton(scene: Scene, at: Point, skill: SkillId) {
  const layout = skillButton(at);
  const chrome = scene.add
    .image(at.x, at.y, chromeTexture(scene, false, false))
    .setOrigin(0)
    .setDisplaySize(SKILL_BUTTON.target, SKILL_BUTTON.target);
  const glyph = scene.add.sprite(layout.glyph.x, layout.glyph.y, SKILL_ART[skill]).setOrigin(0);
  let selected = false;
  let state: boolean | undefined;
  const drawChrome = () => chrome.setTexture(chromeTexture(scene, selected, state === true));
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
