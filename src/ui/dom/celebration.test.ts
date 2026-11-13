// @vitest-environment happy-dom
import { expect, it } from "vitest";

import { TEXT } from "../../data/text.ts";
import { CELEBRATION } from "../layout/restartCard.ts";
import { createCelebrationView } from "./celebration.ts";

it("retains placeholder words, Continue-first focus order and authored press areas", () => {
  const view = createCelebrationView(document, TEXT.celebration);
  expect(view.dialog.getAttribute("role")).toBe("region");
  expect(view.dialog.querySelector("h2")?.textContent).toBe(TEXT.celebration.title);
  expect(view.dialog.querySelector("p")?.textContent).toBe(TEXT.celebration.message);
  expect([...view.dialog.querySelectorAll("button")]).toEqual([
    view.buttons.continue,
    view.buttons.restart,
  ]);
  for (const key of ["continue", "restart"] as const) {
    expect(view.buttons[key].textContent).toBe(TEXT.celebration[key]);
    expect(view.buttons[key].style.getPropertyValue("--celebration-hit-width")).toBe(
      String(CELEBRATION[key].hit.width),
    );
  }
  expect(Object.values(view.images).every((image) => image.alt === "")).toBe(true);
  expect(view.close).toBeUndefined();
});
