// @vitest-environment happy-dom
import { ACTION_GAPS, arrangeActions } from "@andornaut/game-kit/runtime/ui/actionGroup";
import { expect, it } from "vitest";

import palette from "../../../public/art/palette.json" with { type: "json" };
import { TEXT_BUTTON } from "../../data/layout.ts";
import { SCREEN } from "../../data/screen.ts";
import { TEXT } from "../../data/text.ts";
import { hitMargin } from "../layout/hitAreas.ts";
import { startScreenLayout } from "../layout/startScreen.ts";
import { actionRole } from "./actions.ts";
import { createStart } from "./start.ts";

const colour = (name: keyof typeof palette.colours) =>
  Number.parseInt(palette.colours[name].slice(1), 16);
const colours = {
  cream: colour("cream"),
  dslate: colour("dslate"),
  ink: colour("ink"),
  navy: colour("navy"),
  white: colour("white"),
};
const LOGO = { height: 239, width: 558 };
const face = (width: number) => ({ height: TEXT_BUTTON.height, width });
const MARGIN = hitMargin({ ...face(TEXT_BUTTON.height), x: 0, y: 0 });

it.each([
  { exit: false, saved: false },
  { exit: false, saved: true },
  { exit: true, saved: false },
  { exit: true, saved: true },
])(
  "names the Start screen's controls and orders the focus Start, Restart, Exit with %o",
  ({ exit, saved }) => {
    const layout = startScreenLayout(LOGO, exit, saved);
    const view = createStart(document, colours, TEXT.start, layout);
    expect(view.root.getAttribute("role")).toBe("region");
    expect(view.root.getAttribute("aria-label")).toBe(TEXT.start.name);
    expect(view.logo.alt).toBe(TEXT.start.logo);
    const order = ["start", ...(saved ? ["restart"] : []), ...(exit ? ["exit"] : [])];
    expect([...view.buttons.keys()]).toEqual(order);
    expect([...view.root.querySelectorAll("button")]).toEqual([...view.buttons.values()]);
    expect(
      [...view.root.querySelectorAll("button")].map((button) => button.dataset.control),
    ).toEqual(order);
    const start = view.buttons.get("start")!;
    expect(start.textContent).toBe(saved ? TEXT.start.continue : TEXT.start.start);
    expect(actionRole(start)).toBe("primary");
    expect(view.buttons.get("restart")?.textContent).toBe(saved ? TEXT.start.restart : undefined);
    expect(view.buttons.get("exit")?.getAttribute("aria-label")).toBe(
      exit ? TEXT.start.exit : undefined,
    );
    for (const button of view.buttons.values()) {
      expect(button.disabled).toBe(false);
      expect(button.hidden).toBe(false);
    }
  },
);

it("places the footer row, the logo and Exit from the screen layout", () => {
  const layout = startScreenLayout(LOGO, true, true);
  const view = createStart(document, colours, TEXT.start, layout);
  const number = (name: string, element: HTMLElement) =>
    Number(element.style.getPropertyValue(name));
  expect(number("--start-action-y", view.actions.element)).toBe(layout.actionY);
  expect(view.actions.element.contains(view.buttons.get("start")!)).toBe(true);
  expect(view.actions.element.contains(view.buttons.get("restart")!)).toBe(true);
  expect(view.actions.element.contains(view.buttons.get("exit")!)).toBe(false);
  expect(number("--start-x", view.logo)).toBe(layout.logo.x);
  expect(number("--start-width", view.logo)).toBe(layout.logo.width);
  const exit = view.buttons.get("exit")!;
  expect(exit.classList.contains("ui-hud-disc")).toBe(true);
  expect(number("--start-x", exit)).toBe(layout.exit!.hit.x);
  expect(number("--start-width", exit)).toBe(layout.exit!.hit.width);
  const face = exit.querySelector<HTMLElement>(".ui-hud-disc-face")!;
  expect(number("--start-width", face)).toBe(layout.exit!.art.width);
  expect(number("--start-x", face)).toBe(layout.exit!.art.x - layout.exit!.hit.x);
  expect(number("--start-y", face)).toBe(layout.exit!.art.y - layout.exit!.hit.y);
  expect(face.querySelector(".ui-hud-disc-art > path")).not.toBeNull();
});

it("centres a sole Start across the view", () => {
  const { actions } = arrangeActions({ width: SCREEN.width }, [
    { key: "start", role: "primary", size: face(96) },
  ]);
  expect(actions).toMatchObject([
    {
      face: { ...face(96), x: (SCREEN.width - 96) / 2, y: 0 },
      outset: { bottom: MARGIN, left: MARGIN, right: MARGIN, top: MARGIN },
    },
  ]);
});

it("shows Restart on the left and Continue on the right, 16 px apart, centred as a pair", () => {
  const gap = ACTION_GAPS.standard.row;
  expect(gap).toBe(TEXT_BUTTON.gap);
  // Focus order: Continue, then Restart.
  const arrangement = arrangeActions({ width: SCREEN.width }, [
    { key: "start", role: "primary", size: face(128) },
    { key: "restart", role: "secondary", size: face(112) },
  ]);
  expect(arrangement.axis).toBe("row");
  const placed = Object.fromEntries(
    arrangement.actions.map((action) => [action.key, action] as const),
  );
  const left = (SCREEN.width - (112 + gap + 128)) / 2;
  expect(placed.restart).toMatchObject({
    face: { ...face(112), x: left, y: 0 },
    outset: { left: MARGIN, right: gap / 2 },
  });
  expect(placed.start).toMatchObject({
    face: { ...face(128), x: left + 112 + gap, y: 0 },
    outset: { left: gap / 2, right: MARGIN },
  });
});
