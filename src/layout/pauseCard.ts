import { SCREEN } from "../data/screen";
import type { GameText, Point, Rect } from "../data/types";
import { TEXT_BUTTON } from "./buttonLabel";
import {
  CARD_CONTENT,
  cardActionsSize,
  type CardFonts,
  cardTextSize,
  contentCardLayout,
} from "./contentCard";
import { hitAround, hitMargin } from "./hitAreas";
import { labelledButton } from "./labelledButton";
import { CONTROL_EDGE } from "./playView";

// Pause actions fill the panel body with equal side padding and standard action gaps.
export function pauseCard(fonts: CardFonts, words: GameText["pause"]) {
  const labels = [words.resume, words.settings, words.home];
  const actions = {
    ...cardActionsSize(fonts.title, "stack", labels),
    height: labels.length * TEXT_BUTTON.height + (labels.length - 1) * CARD_CONTENT.gap,
  };
  const bounds = { ...SCREEN, x: 0, y: 0 };
  const header = { close: true, titleWidth: cardTextSize(fonts.title, words.title).width };
  const measured = contentCardLayout(bounds, [{ ...actions, key: "actions" }], header);
  const width = measured.card.width - 2 * CARD_CONTENT.padding;
  // Reserve the expanded hit area of the actual filled-width actions below the close target.
  const layout = contentCardLayout(
    bounds,
    [
      {
        ...actions,
        hitOutset: hitMargin({ height: TEXT_BUTTON.height, width, x: 0, y: 0 }),
        key: "actions",
        width,
      },
    ],
    header,
  );
  const group = layout.groups.actions!;
  const [resume, settings, home] = labels.map((_, index) =>
    labelledButton({
      height: TEXT_BUTTON.height,
      width: group.width,
      x: group.x,
      y: group.y + index * (TEXT_BUTTON.height + CARD_CONTENT.gap),
    }),
  );
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

// Cards use the shared native bitmap-font scale.
export { CARD_TEXT_SCALE } from "./cardFrame";
