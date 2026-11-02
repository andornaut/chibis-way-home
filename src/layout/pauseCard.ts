import { SCREEN } from "../data/screen";
import type { GameText, Point, Rect } from "../data/types";
import {
  cardActions,
  cardActionsSize,
  type CardFonts,
  cardTextSize,
  contentCardLayout,
} from "./contentCard";
import { hitAround } from "./hitAreas";
import { CONTROL_EDGE } from "./playView";

// Pause actions share the width of their widest label.
export function pauseCard(fonts: CardFonts, words: GameText["pause"]) {
  const labels = [words.resume, words.settings, words.home];
  const actions = cardActionsSize(fonts.body, "stack", labels);
  const layout = contentCardLayout({ ...SCREEN, x: 0, y: 0 }, [{ ...actions, key: "actions" }], {
    close: true,
    titleWidth: cardTextSize(fonts.title, words.title).width,
  });
  const [resume, settings, home] = cardActions(fonts.body, "stack", layout.groups.actions!, labels);
  return {
    card: layout.card,
    close: layout.close!,
    home: home!,
    resume: resume!,
    settings: settings!,
    title: layout.title!,
  };
}

// Art's pause button in the game's top-left corner: where its frame is drawn, and the area a
// press must land in, its frame grown by hitAreas.ts's rule. Art draws the disc 1px inside its
// frame, so the disc's edge sits CONTROL_EDGE in from the view's top and left.
const PAUSE_ART: Rect = { height: 35, width: 35, x: CONTROL_EDGE - 1, y: CONTROL_EDGE - 1 };

export const PAUSE_BUTTON = {
  art: PAUSE_ART,
  at: { x: PAUSE_ART.x, y: PAUSE_ART.y } satisfies Point,
  hit: hitAround(PAUSE_ART),
} as const;

// Text on the card is set at this scale: art's fonts are native at 8px and drawn at 2x.
export { CARD_TEXT_SCALE } from "./cardFrame";
