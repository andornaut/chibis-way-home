import { SCREEN } from "../data/screen";
import { TEXT } from "../data/text";
import { CARD_CONTENT, cardTextSize } from "../layout/contentCard";
import { departureDialogueButtons, DIALOGUE_SCREEN } from "../layout/dialogueScreen";
import type { RunStatsSummary, ZoneStatsSummary } from "../save/stats";
import { cardFonts } from "./cardParts";
import { type DialogueData, DialogueScene } from "./DialogueScene";
import { addStageSummary } from "./runStatsParts";

export interface ZoneDepartureData extends DialogueData {
  readonly stage: string;
  readonly cleared: boolean;
  readonly runStats: RunStatsSummary;
  readonly zoneStats: ZoneStatsSummary;
}

// The exchange consumes normal dialogue input over an opaque black departure view.
export class ZoneDepartureScene extends DialogueScene {
  private summary!: ZoneDepartureData;
  override init(data: ZoneDepartureData): void {
    super.init(data);
    this.summary = data;
  }
  override create(): void {
    super.create();
    const fonts = cardFonts(this);
    const buttons = departureDialogueButtons({
      continue: cardTextSize(fonts.body, TEXT.dialogue.continue).width,
      skip: cardTextSize(fonts.body, TEXT.dialogue.skip).width,
    });
    const top = DIALOGUE_SCREEN.box.y + DIALOGUE_SCREEN.box.height + CARD_CONTENT.gap;
    addStageSummary(
      this,
      {
        height: buttons.continue.hit.y - CARD_CONTENT.gap - top,
        width: SCREEN.width - 2 * CARD_CONTENT.padding,
        x: CARD_CONTENT.padding,
        y: top,
      },
      this.summary,
    );
  }
  constructor() {
    super("zoneDeparture", true);
  }
}
