// @vitest-environment happy-dom
import { ACTION_GAPS, arrangeActions } from "@andornaut/game-kit/runtime/ui/actionGroup";
import { expect, it, vi } from "vitest";

import { TEXT_BUTTON } from "../../data/layout.ts";
import { OPENING } from "../../data/opening.ts";
import { TEXT } from "../../data/text.ts";
import { hitMargin } from "../layout/index.ts";
import { actionRole, rowWidth } from "./actions.ts";
import { createOpeningView, showOpeningCaption } from "./opening.ts";

const WORDS = { ...TEXT.dialogue, name: TEXT.opening.name };
const face = (width: number) => ({ height: TEXT_BUTTON.height, width });

it("names the opening story region and its actions from the text data", () => {
  const view = createOpeningView(document, WORDS);
  expect(view.root.getAttribute("role")).toBe("region");
  expect(view.root.getAttribute("aria-label")).toBe(TEXT.opening.name);
  for (const action of ["continue", "previous", "skip"] as const) {
    const button = view.buttons[action];
    expect(button.textContent).toBe(TEXT.dialogue[action]);
    expect(button.dataset.control).toBe(action);
    expect(button.disabled).toBe(false);
    expect(button.hidden).toBe(action === "previous");
  }
  expect(actionRole(view.buttons.continue)).toBe("primary");
  expect(actionRole(view.buttons.previous)).toBe("secondary");
  expect(actionRole(view.buttons.skip)).toBe("secondary");
  expect(view.buttons.continue.querySelector("svg, img")).toBeNull();
});

it("keeps Next and Previous in the footer, with Skip in a separate action group", () => {
  const view = createOpeningView(document, WORDS);
  expect([...view.root.querySelectorAll("button")]).toEqual([
    view.buttons.continue,
    view.buttons.previous,
    view.buttons.skip,
  ]);
  expect([...view.actions.element.children]).toEqual([
    view.buttons.continue,
    view.buttons.previous,
  ]);
  expect(view.actions.element.parentElement?.classList.contains("opening-footer")).toBe(true);
  const skipGroup = view.buttons.skip.parentElement!;
  expect(skipGroup.matches(".opening-skip[data-ui-layout]")).toBe(true);
  expect([...skipGroup.children]).toEqual([view.buttons.skip]);
  expect(skipGroup.closest(".opening-footer")).toBeNull();
});

it("announces each caption as plain text without measuring during playback", () => {
  const view = createOpeningView(document, WORDS);
  document.body.append(view.root);
  const measure = vi
    .spyOn(HTMLElement.prototype, "getBoundingClientRect")
    .mockImplementation(() => {
      throw new Error("The opening must not measure while a caption changes");
    });
  try {
    expect(view.caption.getAttribute("aria-live")).toBe("polite");
    expect(view.caption.textContent).toBe("");
    for (const beat of OPENING) {
      const text = TEXT.lines[beat.text]!;
      showOpeningCaption(text, view);
      expect(view.caption.textContent).toBe(text);
      expect(view.caption.children).toHaveLength(0);
    }
    expect(measure).not.toHaveBeenCalled();
  } finally {
    measure.mockRestore();
    view.root.remove();
  }
});

it("places Previous to the left of primary Next in a row as wide as both", () => {
  const gap = ACTION_GAPS.standard.row;
  const margin = hitMargin({ ...face(TEXT_BUTTON.height), x: 0, y: 0 });
  const width = rowWidth(undefined, [120, 72]);
  expect(width).toBe(120 + TEXT_BUTTON.gap + 72);
  expect(rowWidth(undefined, [120])).toBe(120);
  // Focus order: Next, then Previous.
  const arrangement = arrangeActions({ axis: "row", width }, [
    { key: "continue", role: "primary", size: face(120) },
    { key: "previous", role: "secondary", size: face(72) },
  ]);
  expect(arrangement.group).toMatchObject({ height: TEXT_BUTTON.height, width });
  const placed = Object.fromEntries(
    arrangement.actions.map((action) => [action.key, action] as const),
  );
  expect(placed.previous).toMatchObject({
    face: { ...face(72), x: 0, y: 0 },
    outset: { left: margin, right: gap / 2 },
  });
  expect(placed.continue).toMatchObject({
    face: { ...face(120), x: 72 + gap, y: 0 },
    outset: { left: gap / 2, right: margin },
  });
});
