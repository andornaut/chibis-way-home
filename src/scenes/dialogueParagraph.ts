import { type AsepriteSheet, sheetTags } from "@andornaut/game-kit/art/aseprite";
import { inkWidth } from "@andornaut/game-kit/text/bitmapFont";
import {
  phaserBitmapFont,
  type PhaserFontData,
} from "@andornaut/game-kit/text/phaser/phaserBitmapFont";
import type { GameObjects, Scene } from "phaser";

import { DIALOGUE_LAYOUT } from "../data/layout.ts";
import type { Rect } from "../data/types/index.ts";
import {
  DIALOGUE_PORTRAIT_SIZE,
  DIALOGUE_SCREEN,
  dialogueLines,
  dialogueNameTab,
  type DialogueParagraph,
  dialogueSpeakerLayout,
  dialogueTextRows,
} from "../ui/index.ts";
import {
  addCardText,
  addCardTextIn,
  addSlice,
  BODY_FONT,
  paletteColour,
  TITLE_FONT,
} from "./cardParts.ts";

// The room's gift panel on the canvas: the speaker's portrait, name tab and text, drawn above the
// shared panel from drawDialoguePanel. Conversations, barks and notices show the same panel in the
// HTML UI (src/ui/dom/dialogue.ts).

type PanelFont = ReturnType<typeof phaserBitmapFont>;

function panelFont(scene: Scene, key: string): PanelFont {
  return phaserBitmapFont(scene.cache.bitmapFont.get(key).data as PhaserFontData);
}

// The speaker's portrait (a dslate slot for a null one), name tab and text.
export function drawDialogueParagraph(
  scene: Scene,
  paragraph: DialogueParagraph,
): GameObjects.GameObject[] {
  if (paragraph.portrait !== null && !scene.textures.exists(paragraph.portrait)) {
    throw new Error(`Missing dialogue portrait ${paragraph.portrait}`);
  }
  const layout = dialogueSpeakerLayout(paragraph.side);
  const text = DIALOGUE_SCREEN.text;
  const fonts = { body: panelFont(scene, BODY_FONT), title: panelFont(scene, TITLE_FONT) };
  const body = dialogueLines(fonts.body, text, text.width, paragraph.text);
  const rows = dialogueTextRows(fonts, body.length);
  const frame = layout.portraitFrame;
  const tab = dialogueNameTab(
    paragraph.side,
    inkWidth(fonts.title, DIALOGUE_SCREEN.text.scale, paragraph.name),
  );
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
          .image(layout.portrait.x, layout.portrait.y, paragraph.portrait)
          .setOrigin(0)
          .setDisplaySize(DIALOGUE_PORTRAIT_SIZE, DIALOGUE_PORTRAIT_SIZE),
    ...drawNameTab(scene, tab, paragraph),
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
