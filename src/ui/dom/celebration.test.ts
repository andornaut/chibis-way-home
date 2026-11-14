// @vitest-environment happy-dom
import { expect, it } from "vitest";

import { TEXT } from "../../data/text.ts";
import { CELEBRATION } from "../layout/celebrationCard.ts";
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
    expect(
      view.buttons[key]
        .querySelector(".ui-text-button-face")!
        .hasAttribute("data-ui-authored-size"),
    ).toBe(true);
    expect(view.buttons[key].textContent).toBe(TEXT.celebration[key]);
    expect(view.buttons[key].style.getPropertyValue("--celebration-hit-width")).toBe(
      String(CELEBRATION[key].hit.width),
    );
  }
  expect(Object.values(view.images).every((image) => image.alt === "")).toBe(true);
  expect(view.close).toBeUndefined();
});

it("materializes fresh authored chrome slots through the same production card factory", () => {
  const live = createCelebrationView(document, TEXT.celebration);
  document.body.append(live.root);
  live.images.normal.src = "blob:runtime-chrome";
  const authored = createCelebrationView(document, TEXT.celebration);
  expect(authored.images.normal.getAttribute("src")).toBeNull();
  expect(authored.buttons.continue).not.toBe(live.buttons.continue);
  expect(authored.buttons.continue.querySelector(".ui-text-button-label img")).toBe(
    authored.images.mark,
  );
  expect(authored.dialog.getAttribute("role")).toBe("region");
  live.root.remove();
});
