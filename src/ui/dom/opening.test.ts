// @vitest-environment happy-dom
import { expect, it, vi } from "vitest";

import { CARD_CONTENT, PLAY_MARK, TEXT_BUTTON } from "../../data/layout.ts";
import { OPENING } from "../../data/opening.ts";
import { TEXT } from "../../data/text.ts";
import { createOpeningView, showOpeningCaption } from "./opening.ts";

it("keeps each caption as plain text and Continue first without freezing native text geometry", () => {
  const measure = vi
    .spyOn(HTMLElement.prototype, "getBoundingClientRect")
    .mockImplementation(() => {
      throw new Error("The native opening must not measure a caption during playback");
    });
  try {
    const view = createOpeningView(document, TEXT.dialogue);
    for (const beat of OPENING) {
      const text = TEXT.lines[beat.text]!;
      showOpeningCaption(text, view);
      expect(view.caption.textContent).toBe(text);
      expect(view.caption.getAttribute("aria-live")).toBe("polite");
      expect([...view.root.querySelectorAll("button")]).toEqual([
        view.buttons.continue,
        view.buttons.skip,
      ]);
      expect(view.caption.getAttribute("style")).toBeNull();
      for (const action of ["continue", "skip"] as const) {
        expect(view.buttons[action].textContent).toBe(TEXT.dialogue[action]);
        expect(view.buttons[action].getAttribute("style")).toBeNull();
      }
    }
    expect(measure).not.toHaveBeenCalled();
  } finally {
    measure.mockRestore();
  }
});

it("keeps the fixed footer and play mark geometry while the browser supplies label widths", () => {
  const view = createOpeningView(document, TEXT.dialogue);
  expect(view.root.style.getPropertyValue("--opening-footer-height")).toBe(
    String(TEXT_BUTTON.height + 2 * CARD_CONTENT.padding),
  );
  expect(view.root.style.getPropertyValue("--opening-mark-lead")).toBe(
    String(PLAY_MARK.width + PLAY_MARK.gap),
  );
  expect(view.root.querySelector(".opening-footer")?.contains(view.caption)).toBe(true);
  expect(view.buttons.continue.querySelector(".ui-text-button-label")?.contains(view.mark)).toBe(
    true,
  );
  expect(view.mark.alt).toBe("");
});
