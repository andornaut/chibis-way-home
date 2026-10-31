import { laidGlyphs, parseBitmapFont } from "@andornaut/game-kit/text/bitmapFont";
import { describe, expect, it } from "vitest";

import fontBody from "../../public/art/fonts/font-body.fnt?raw";
import fontTitle from "../../public/art/fonts/font-title.fnt?raw";
import { SCREEN } from "../data/screen";
import { TEXT } from "../data/text";
import { CARD_TEXT_SCALE } from "./cardFrame";
import {
  CARD_CONTENT,
  cardActions,
  cardActionsSize,
  cardTextOrigin,
  cardTextRowsSize,
  contentCardLayout,
} from "./contentCard";

const BODY = parseBitmapFont(fontBody);
const TITLE = parseBitmapFont(fontTitle);
const VIEW = { ...SCREEN, x: 0, y: 0 };

describe("measured content cards", () => {
  it("measures equal action faces from the widest actual label and includes only present gaps", () => {
    const labels = [TEXT.pause.home, TEXT.death.retry];
    const actions = cardActionsSize(BODY, "row", labels);
    const rows = cardTextRowsSize(BODY, ["City", "Stage 1", "Progress: 25%", "Time: 1:05"]);
    const result = contentCardLayout(VIEW, [
      { key: "rows", ...rows },
      { height: 0, key: "absent", width: 0 },
      { key: "actions", ...actions },
    ]);
    expect(result.card.height).toBe(164);
    expect(result.card.y + result.card.height / 2).toBe(SCREEN.height / 2);
    expect(result.card.x + result.card.width / 2).toBe(SCREEN.width / 2);
    const rect = result.groups.actions;
    if (!rect) {
      throw new Error("Missing measured actions");
    }
    const faces = cardActions(BODY, "row", rect, labels).map(({ button }) => button);
    expect(faces.map(({ height, width }) => ({ height, width }))).toEqual([
      { height: 48, width: 114 },
      { height: 48, width: 114 },
    ]);
    expect(rect.x + rect.width / 2).toBe(result.card.x + result.card.width / 2);
  });

  it.each([false, true])(
    "includes the optional close control without shrinking the title (close=%s)",
    (close) => {
      const titleWidth = 180;
      const result = contentCardLayout(VIEW, [], { close, titleWidth });
      expect(result.title?.width).toBeGreaterThanOrEqual(titleWidth);
      expect(result.close === undefined).toBe(!close);
    },
  );

  it("expands for long content instead of forcing a standard width", () => {
    const narrow = contentCardLayout(VIEW, [{ height: 16, key: "label", width: 80 }]);
    const wide = contentCardLayout(VIEW, [{ height: 16, key: "label", width: 400 }]);
    expect(wide.card.width).toBeGreaterThan(narrow.card.width);
    expect(wide.card.width).toBe(400 + 2 * CARD_CONTENT.padding);
  });

  it.each([SCREEN.width, 400, 280])(
    "uses the full viewport minimum within an available width of %s",
    (availableWidth) => {
      const result = contentCardLayout({ ...VIEW, width: availableWidth, x: 10, y: 20 }, [
        { height: 16, key: "text", width: 80 },
      ]);
      expect(result.card.width).toBe(Math.min(availableWidth, SCREEN.width / 2));
      expect(result.groups.text?.width).toBe(80);
      expect(result.card.x + result.card.width / 2).toBe(10 + availableWidth / 2);
      expect(result.card.y + result.card.height / 2).toBe(20 + SCREEN.height / 2);
    },
  );

  it("rejects content that the available view cannot fit without clipping", () => {
    expect(() =>
      contentCardLayout({ ...VIEW, width: 100 }, [{ height: 16, key: "text", width: 100 }]),
    ).toThrow("Card content exceeds the view");
  });

  it.each([BODY, TITLE])("centres actual ink rather than the first glyph bearing", (font) => {
    const text = "Hint";
    const rect = { height: 16, width: 180, x: 20, y: 30 };
    const at = cardTextOrigin(font, rect, text);
    const spans = laidGlyphs(font, CARD_TEXT_SCALE, text).flatMap(({ ink }) => ink ?? []);
    const left = Math.min(...spans.map((span) => span.left)) + at.x;
    const right = Math.max(...spans.map((span) => span.right)) + at.x;
    expect(Math.abs((left + right) / 2 - (rect.x + rect.width / 2))).toBeLessThanOrEqual(0.5);
  });
});
