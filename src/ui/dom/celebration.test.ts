// @vitest-environment happy-dom
import { expect, it } from "vitest";

import { TEXT } from "../../data/text.ts";
import { createCelebrationView } from "./celebration.ts";

it("keeps the story and Continue-first focus order with standard row actions", () => {
  const view = createCelebrationView(document, TEXT.celebration);
  expect(view.dialog.getAttribute("role")).toBe("region");
  expect(view.dialog.dataset.cardWidth).toBe("small");
  expect(view.dialog.parentElement?.classList.contains("ui-card-view")).toBe(true);
  expect(view.dialog.querySelector("h2")?.textContent).toBe(TEXT.celebration.title);
  const message = view.dialog.querySelector("p")!;
  expect(message.textContent).toBe(TEXT.celebration.message);
  expect(message.nextElementSibling).toBe(view.buttons.continue.parentElement);
  expect([...view.dialog.querySelectorAll("button")]).toEqual([
    view.buttons.continue,
    view.buttons.restart,
  ]);
  expect(view.buttons.continue.parentElement?.dataset.uiAxis).toBe("row");
  expect(view.buttons.continue.classList.contains("ui-text-button-primary")).toBe(true);
  for (const key of ["continue", "restart"] as const) {
    expect(
      view.buttons[key]
        .querySelector(".ui-text-button-face")!
        .hasAttribute("data-ui-authored-size"),
    ).toBe(false);
    expect(view.buttons[key].textContent).toBe(TEXT.celebration[key]);
    expect(
      view.buttons[key].querySelector(".ui-text-button-face")?.classList.contains("ui-frame"),
    ).toBe(true);
  }
  expect(view.close).toBeUndefined();
});

it("keeps the decorative play mark inside Continue's measured label and isolates its source", () => {
  const live = createCelebrationView(document, TEXT.celebration);
  live.mark.style.setProperty("--celebration-mark-image", 'url("blob:runtime-mark")');
  const fresh = createCelebrationView(document, TEXT.celebration);
  expect(fresh.mark.style.getPropertyValue("--celebration-mark-image")).toBe("");
  expect(fresh.buttons.continue.querySelector(".ui-text-button-label")?.firstElementChild).toBe(
    fresh.mark,
  );
  expect(fresh.buttons.restart.contains(fresh.mark)).toBe(false);
  expect(fresh.mark.getAttribute("aria-hidden")).toBe("true");
});
