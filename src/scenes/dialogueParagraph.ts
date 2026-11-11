import { type AsepriteSheet, sheetTags } from "@andornaut/game-kit/art/aseprite";
import { inkWidth } from "@andornaut/game-kit/text/bitmapFont";
import {
  phaserBitmapFont,
  type PhaserFontData,
} from "@andornaut/game-kit/text/phaser/phaserBitmapFont";
import type { GameObjects, Scene } from "phaser";

import { DIALOGUE_LAYOUT } from "../data/layout";
import type { Rect } from "../data/types";
import {
  DIALOGUE_PORTRAIT_SIZE,
  DIALOGUE_SCREEN,
  dialogueBodyLines,
  dialogueLines,
  dialogueNameTab,
  type DialogueParagraph,
  dialoguePressAreas,
  dialogueSpeakerLayout,
  dialogueTextRows,
  type PressArea,
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

type PanelFont = ReturnType<typeof phaserBitmapFont>;

function panelFont(scene: Scene, key: string): PanelFont {
  return phaserBitmapFont(scene.cache.bitmapFont.get(key).data as PhaserFontData);
}

// The paragraph's name tab, or undefined when it shows none: a null name or a heading.
export function dialogueParagraphTab(scene: Scene, paragraph: PanelParagraph): Rect | undefined {
  if (paragraph.name === null || paragraph.heading !== undefined) {
    return undefined;
  }
  return dialogueNameTab(
    paragraph.side,
    inkWidth(panelFont(scene, TITLE_FONT), DIALOGUE_SCREEN.text.scale, paragraph.name),
  );
}

// The paragraph's press areas: the panel and its name tab together.
export function dialogueParagraphPressAreas(
  scene: Scene,
  paragraph: PanelParagraph,
): readonly PressArea<"continue">[] {
  return dialoguePressAreas(dialogueParagraphTab(scene, paragraph));
}

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
  const fonts = { body: panelFont(scene, BODY_FONT), title: panelFont(scene, TITLE_FONT) };
  const heading = paragraph.heading;
  if (heading !== undefined && inkWidth(fonts.title, text.scale, heading) > text.width) {
    throw new Error(`Dialogue heading does not fit: ${heading}`);
  }
  const header = heading === undefined ? "name-tab" : "heading";
  const body = dialogueLines(
    fonts.body,
    { ...text, lines: dialogueBodyLines(header) },
    text.width,
    paragraph.text,
  );
  const rows = dialogueTextRows(fonts, header, body.length);
  const frame = layout.portraitFrame;
  const tab = dialogueParagraphTab(scene, paragraph);
  return [
    scene.add.image(frame.x, frame.y, "ui-portrait-frame").setOrigin(0),
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
    ...(tab === undefined || paragraph.name === null
      ? []
      : drawNameTab(scene, tab, paragraph as Pick<DialogueParagraph, "colour" | "name">)),
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
  tab: Rect,
  { colour, name }: Pick<DialogueParagraph, "colour" | "name">,
): GameObjects.GameObject[] {
  const frame = sheetTags(scene.cache.json.get("ui-name-tab") as AsepriteSheet).get(colour)?.[0]
    ?.frame;
  if (frame === undefined) {
    throw new Error(`Missing dialogue name-tab colour ${colour}`);
  }
  const inset = DIALOGUE_LAYOUT.nameTab.inset;
  return [
    addSlice(scene, "ui-name-tab", tab, frame),
    addCardTextIn(
      scene,
      TITLE_FONT,
      { ...tab, width: tab.width - 2 * inset, x: tab.x + inset },
      name,
      paletteColour(scene, "ink"),
    ),
  ];
}
