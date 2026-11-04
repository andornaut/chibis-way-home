import { type AsepriteSheet, sheetTags } from "@andornaut/game-kit/art/aseprite";
import { inkWidth } from "@andornaut/game-kit/text/bitmapFont";
import {
  phaserBitmapFont,
  type PhaserFontData,
} from "@andornaut/game-kit/text/phaser/phaserBitmapFont";
import type { GameObjects, Scene } from "phaser";

import {
  DIALOGUE_SCREEN,
  dialogueLines,
  dialogueNameTab,
  type DialogueParagraph,
  dialogueSpeakerLayout,
} from "../ui";
import {
  addCardText,
  addCardTextIn,
  addSlice,
  BODY_FONT,
  paletteColour,
  TITLE_FONT,
} from "./cardParts";

export function drawDialogueParagraph(
  scene: Scene,
  paragraph: DialogueParagraph,
): GameObjects.GameObject[] {
  if (paragraph.portrait !== null && !scene.textures.exists(paragraph.portrait)) {
    throw new Error(`Missing dialogue portrait ${paragraph.portrait}`);
  }
  const layout = dialogueSpeakerLayout(paragraph.side);
  const text = DIALOGUE_SCREEN.text;
  const nameFont = phaserBitmapFont(scene.cache.bitmapFont.get(TITLE_FONT).data as PhaserFontData);
  const tab = dialogueNameTab(paragraph.side, inkWidth(nameFont, text.scale, paragraph.name));
  if (tab.x + tab.width > layout.textX + text.width) {
    throw new Error(`Dialogue speaker name does not fit: ${paragraph.name}`);
  }
  const frame = sheetTags(scene.cache.json.get("ui-name-tab") as AsepriteSheet).get(
    paragraph.colour,
  )?.[0]?.frame;
  if (frame === undefined) {
    throw new Error(`Missing dialogue name-tab colour ${paragraph.colour}`);
  }
  return [
    scene.add
      .image(layout.portraitFrame.x, layout.portraitFrame.y, "ui-portrait-frame")
      .setOrigin(0),
    paragraph.portrait === null
      ? scene.add
          .rectangle(layout.portrait.x, layout.portrait.y, 64, 64, paletteColour(scene, "dslate"))
          .setOrigin(0)
      : scene.add.image(layout.portrait.x, layout.portrait.y, paragraph.portrait).setOrigin(0),
    addSlice(scene, "ui-name-tab", tab, frame),
    addCardTextIn(
      scene,
      TITLE_FONT,
      { ...tab, width: tab.width - 12, x: tab.x + 6 },
      paragraph.name,
      paletteColour(scene, "ink"),
    ),
    ...dialogueLines(
      phaserBitmapFont(scene.cache.bitmapFont.get(BODY_FONT).data as PhaserFontData),
      text,
      text.width,
      paragraph.text,
    ).map((line, index) =>
      addCardText(
        scene,
        BODY_FONT,
        { x: layout.textX, y: text.y + index * text.pitch },
        line,
        paletteColour(scene, "cream"),
      ),
    ),
  ];
}
