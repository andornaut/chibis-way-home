import { inkWidth } from "@andornaut/game-kit/text/bitmapFont";
import { describe, expect, it } from "vitest";

import { TEXT } from "../../data/text";
import { ACHIEVEMENT_IDS } from "../../progress";
import { CARD_FONTS } from "../../testing/cardFonts";
import { dialogueLines } from "../dialogue/conversation";
import { achievementsCardProperties, achievementsPerPage } from "./achievementsCard";
import { DIALOGUE_SCREEN, dialogueBodyLines } from "./dialogueScreen";

describe("the Achievements card", () => {
  it("pages all 26 entries, six to a page in three rows, in full pages before the last", () => {
    const perPage = achievementsPerPage();
    expect({
      lastPage: ACHIEVEMENT_IDS.length - 4 * perPage,
      pages: Math.ceil(ACHIEVEMENT_IDS.length / perPage),
      perPage,
      rows: achievementsCardProperties(ACHIEVEMENT_IDS.length)["--achievements-rows"],
    }).toEqual({ lastPage: 2, pages: 5, perPage: 6, rows: 3 });
  });

  it("fits every unlock notice's bold line and description in the dialogue panel's text", () => {
    const text = DIALOGUE_SCREEN.text;
    const lines = dialogueBodyLines("heading");
    const fits = (wrap: () => unknown) => {
      try {
        wrap();
        return true;
      } catch {
        return false;
      }
    };
    const unfit = ACHIEVEMENT_IDS.filter((id) => {
      const { description, title } = TEXT.achievements.entries[id];
      const heading = TEXT.achievements.notice.replace("{title}", title);
      return (
        inkWidth(CARD_FONTS.title, text.scale, heading) > text.width ||
        !fits(() => dialogueLines(CARD_FONTS.body, { ...text, lines }, text.width, description))
      );
    });
    expect(unfit).toEqual([]);
  });
});
