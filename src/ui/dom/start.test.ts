// @vitest-environment happy-dom
import { expect, it } from "vitest";

import { TEXT } from "../../data/text.ts";
import { startScreenLayout } from "../layout/startScreen.ts";
import { createStart } from "./start.ts";

it.each([false, true])(
  "keeps Start's native control names, geometry and keyboard order with saved=%s",
  (saved) => {
    const layout = startScreenLayout({ height: 239, width: 558 }, true, saved);
    const view = createStart(document, TEXT.start, layout);
    expect([...view.buttons.keys()]).toEqual([
      "start",
      ...(saved ? ["restart"] : []),
      "achievements",
      "settings",
      "exit",
    ]);
    expect(view.buttons.get("start")!.textContent).toBe(
      saved ? TEXT.start.continue : TEXT.start.start,
    );
    for (const control of ["achievements", "settings", "exit"] as const) {
      const button = view.buttons.get(control)!;
      expect(button.getAttribute("aria-label")).toBe(TEXT.start[control]);
      expect(Number(button.style.getPropertyValue("--start-x"))).toBe(layout[control]!.hit.x);
    }
    expect(view.images.get("logo")!.alt).toBe("");
    expect(Number(view.images.get("logo")!.style.getPropertyValue("--start-width"))).toBe(
      layout.logo.width,
    );
  },
);

it("omits Exit and Restart when the installed window has no exit and there is no saved progress", () => {
  const view = createStart(
    document,
    TEXT.start,
    startScreenLayout({ height: 239, width: 558 }, false, false),
  );
  expect([...view.buttons.keys()]).toEqual(["start", "achievements", "settings"]);
  expect(view.buttons.get("start")!.classList.contains("ui-text-button-primary")).toBe(true);
});
