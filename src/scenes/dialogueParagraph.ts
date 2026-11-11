import { type AsepriteSheet, sheetTags } from "@andornaut/game-kit/art/aseprite";
import { inkWidth } from "@andornaut/game-kit/text/bitmapFont";
import {
  phaserBitmapFont,
  type PhaserFontData,
} from "@andornaut/game-kit/text/phaser/phaserBitmapFont";
import type { GameObjects, Scene } from "phaser";

import { DIALOGUE_LAYOUT } from "../data/layout";
import {
  DIALOGUE_PORTRAIT_SIZE,
  DIALOGUE_SCREEN,
  dialogueLines,
  dialogueNameTab,
  type DialogueParagraph,
  dialogueSpeakerLayout,
  dialogueTextRows,
} from "../ui";
import {
  addCardText,
  addCardTextIn,
  addSlice,
  BODY_FONT,
  paletteColour,
  TITLE_FONT,
} from "./cardParts";

// A panel paragraph: the portrait may name one frame of its texture, drawn scaled to fill the
// portrait; a null name draws no name tab; a heading is a bold first text line above the body.
export type PanelParagraph = Omit<DialogueParagraph, "colour" | "name"> & {
  readonly heading?: string;
  readonly portraitFrame?: string | number;
} & (Pick<DialogueParagraph, "colour" | "name"> | { readonly name: null });

// The speaker's portrait, name tab and text, drawn above the shared panel from drawDialoguePanel.
export function drawDialogueParagraph(
  scene: Scene,
  paragraph: PanelParagraph,
): GameObjects.GameObject[] {
  if (paragraph.portrait !== null && !scene.textures.exists(paragraph.portrait)) {
    throw new Error(`Missing dialogue portrait ${paragraph.portrait}`);
  }
  const layout = dialogueSpeakerLayout(paragraph.side);
  const text = DIALOGUE_SCREEN.text;
  const fonts = {
    body: phaserBitmapFont(scene.cache.bitmapFont.get(BODY_FONT).data as PhaserFontData),
    title: phaserBitmapFont(scene.cache.bitmapFont.get(TITLE_FONT).data as PhaserFontData),
  };
  const heading = paragraph.heading;
  if (heading !== undefined && inkWidth(fonts.title, text.scale, heading) > text.width) {
    throw new Error(`Dialogue heading does not fit: ${heading}`);
  }
  const rows = dialogueTextRows(fonts, heading === undefined ? "name-tab" : "heading");
  const body = dialogueLines(
    fonts.body,
    { ...text, lines: rows.bodyLines },
    text.width,
    paragraph.text,
  );
  return [
    scene.add
      .image(layout.portraitFrame.x, layout.portraitFrame.y, "ui-portrait-frame")
      .setOrigin(0),
    paragraph.portrait === null
      ? scene.add
          .rectangle(
            layout.portrait.x,
            layout.portrait.y,
            DIALOGUE_PORTRAIT_SIZE,
            DIALOGUE_PORTRAIT_SIZE,
            paletteColour(scene, "dslate"),
          )
          .setOrigin(0)
      : scene.add
          .image(layout.portrait.x, layout.portrait.y, paragraph.portrait, paragraph.portraitFrame)
          .setOrigin(0)
          .setDisplaySize(DIALOGUE_PORTRAIT_SIZE, DIALOGUE_PORTRAIT_SIZE),
    ...(paragraph.name === null || rows.tabY === undefined
      ? []
      : drawNameTab(scene, fonts.title, rows.tabY, paragraph)),
    ...(heading === undefined || rows.headingY === undefined
      ? []
      : [
          addCardText(
            scene,
            TITLE_FONT,
            { x: layout.textX, y: rows.headingY },
            heading,
            paletteColour(scene, "cream"),
          ),
        ]),
    ...body.map((line, index) =>
      addCardText(
        scene,
        BODY_FONT,
        { x: layout.textX, y: rows.bodyY + index * text.pitch },
        line,
        paletteColour(scene, "cream"),
      ),
    ),
  ];
}

function drawNameTab(
  scene: Scene,
  font: ReturnType<typeof phaserBitmapFont>,
  tabY: number,
  paragraph: Pick<DialogueParagraph, "colour" | "name" | "side">,
): GameObjects.GameObject[] {
  const { name } = paragraph;
  const layout = dialogueSpeakerLayout(paragraph.side);
  const text = DIALOGUE_SCREEN.text;
  const tab = dialogueNameTab(paragraph.side, tabY, inkWidth(font, text.scale, name));
  if (tab.x + tab.width > layout.textX + text.width) {
    throw new Error(`Dialogue speaker name does not fit: ${name}`);
  }
  const frame = sheetTags(scene.cache.json.get("ui-name-tab") as AsepriteSheet).get(
    paragraph.colour,
  )?.[0]?.frame;
  if (frame === undefined) {
    throw new Error(`Missing dialogue name-tab colour ${paragraph.colour}`);
  }
  return [
    addSlice(scene, "ui-name-tab", tab, frame),
    addCardTextIn(
      scene,
      TITLE_FONT,
      {
        ...tab,
        width: tab.width - 2 * DIALOGUE_LAYOUT.nameTabInset,
        x: tab.x + DIALOGUE_LAYOUT.nameTabInset,
      },
      name,
      paletteColour(scene, "ink"),
    ),
  ];
}
