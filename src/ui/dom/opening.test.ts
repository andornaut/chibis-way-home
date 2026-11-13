// @vitest-environment happy-dom
import { expect, it } from "vitest";

import { OPENING } from "../../data/opening.ts";
import { TEXT } from "../../data/text.ts";
import { CARD_FONTS } from "../../testing/cardFonts.ts";
import { openingLayout } from "../layout/opening.ts";
import { createOpeningView, showOpeningCaption } from "./opening.ts";

it("keeps captions as plain text and Continue first in focus order at the shared layout", () => {
  const view = createOpeningView(document, TEXT.dialogue);
  for (const beat of OPENING) {
    const text = TEXT.lines[beat.text]!;
    const layout = openingLayout(CARD_FONTS, TEXT.dialogue, text);
    showOpeningCaption(layout, text, view);
    expect(view.caption.textContent).toBe(text);
    expect(view.caption.getAttribute("aria-live")).toBe("polite");
    expect([...view.root.querySelectorAll("button")]).toEqual([
      view.buttons.continue,
      view.buttons.skip,
    ]);
    for (const action of ["continue", "skip"] as const) {
      expect(view.buttons[action].textContent).toBe(TEXT.dialogue[action]);
      expect(view.buttons[action].style.left).toContain(String(layout[action].hit.x));
      expect(view.buttons[action].style.width).toContain(String(layout[action].hit.width));
    }
  }
});
