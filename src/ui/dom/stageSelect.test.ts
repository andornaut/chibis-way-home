// @vitest-environment happy-dom
import { pagerState } from "@andornaut/game-kit/runtime/ui/pager";
import { expect, it } from "vitest";

import { ZONE_MAP } from "../../data/map.ts";
import { TEXT } from "../../data/text.ts";
import { STAGES_PER_PAGE } from "../layout/stageSelectCard.ts";
import { createStageSelect } from "./stageSelect.ts";

const paged = ZONE_MAP.destinations.find(({ stages }) => stages.length > STAGES_PER_PAGE)!;
const single = ZONE_MAP.destinations.find(({ stages }) => stages.length <= STAGES_PER_PAGE)!;
const PAGES = TEXT.map.stagePages;

// The picker for a destination whose first unlocked stages are unlocked, on page page.
function picker(destination: typeof paged, unlocked: number, page: number) {
  const open = destination.stages.slice(0, unlocked);
  const pages = Math.ceil(destination.stages.length / STAGES_PER_PAGE);
  return createStageSelect(
    document,
    {
      close: TEXT.map.stageClose,
      locked: TEXT.map.stageLocked,
      pager: PAGES,
      title: TEXT.map.zones[destination.id]!,
    },
    STAGES_PER_PAGE,
    {
      active: () => true,
      countText: (state) =>
        PAGES.page
          .replace("{page}", String(state.page + 1))
          .replace("{pages}", String(state.pages)),
      reducedMotion: () => false,
      state: () => pagerState(page, pages),
      step: () => undefined,
    },
    destination.stages.map((id, index) => ({
      id,
      look: !open.includes(id) ? "locked" : id === open.at(-1) ? "primary" : "normal",
      name: TEXT.map.stages[id]!,
      number: TEXT.map.stageNumber.replace("{number}", String(index + 1)),
    })),
  );
}

const name = (control: Element) => control.getAttribute("aria-label") ?? control.textContent;

it("is a dialog named by its destination whose controls end with the close X", () => {
  const view = picker(paged, 4, 0);
  document.body.append(view.root);
  const controls = [...view.dialog.querySelectorAll("button")];
  expect({
    controls: controls.map(name),
    name: document.getElementById(view.dialog.getAttribute("aria-labelledby")!)?.textContent,
    role: view.dialog.getAttribute("role"),
  }).toEqual({
    controls: [
      ...paged.stages.map(
        (id, index) =>
          `${TEXT.map.stageNumber.replace("{number}", String(index + 1))}${TEXT.map.stages[id]}`,
      ),
      PAGES.previous,
      PAGES.next,
      TEXT.map.stageClose,
    ],
    name: TEXT.map.zones[paged.id],
    role: "dialog",
  });
  view.root.remove();
});

it("keeps every stage in its page in catalogue order, in its look", () => {
  const view = picker(paged, 4, 0);
  expect(
    view.pages.map((page) =>
      [...page.children].map((face) =>
        face.getAttribute("aria-disabled") === "true"
          ? "locked"
          : face.getAttribute("data-ui-button-role") === "primary"
            ? "primary"
            : "normal",
      ),
    ),
  ).toEqual([
    ["normal", "normal", "normal"],
    ["primary", "locked", "locked"],
  ]);
});

it("marks a locked stage unavailable, outside the Tab order and described as locked", () => {
  const view = picker(paged, 4, 0);
  document.body.append(view.root);
  const state = (id: string) => {
    const stage = view.stages.get(id)!;
    return {
      described: document.getElementById(stage.getAttribute("aria-describedby") ?? "")?.textContent,
      disabled: stage.getAttribute("aria-disabled"),
      tabIndex: stage.tabIndex,
    };
  };
  expect([state(paged.stages[3]!), state(paged.stages[4]!)]).toEqual([
    { described: undefined, disabled: null, tabIndex: 0 },
    { described: TEXT.map.stageLocked, disabled: "true", tabIndex: -1 },
  ]);
  view.root.remove();
});

it.each([
  { next: 0, page: 0, previous: -1 },
  { next: -1, page: 1, previous: 0 },
])(
  "announces page $page's count politely between Previous and Next, and takes a step with no page out of the Tab order",
  ({ next, page, previous }) => {
    const { pager } = picker(paged, 4, page);
    expect({
      count: pager!.count.textContent,
      live: pager!.count.getAttribute("aria-live"),
      next: pager!.next.element.tabIndex,
      order: [...pager!.element.children],
      previous: pager!.previous.element.tabIndex,
      refused: [pager!.previous.element, pager!.next.element].map((button) => ({
        disabled: button.disabled,
        unavailable: button.getAttribute("aria-disabled") === "true",
      })),
    }).toEqual({
      count: PAGES.page.replace("{page}", String(page + 1)).replace("{pages}", "2"),
      live: "polite",
      next,
      order: [pager!.previous.element, pager!.count, pager!.next.element],
      previous,
      refused: [
        { disabled: false, unavailable: previous === -1 },
        { disabled: false, unavailable: next === -1 },
      ],
    });
  },
);

it("shows no pager on a card of one page", () => {
  const view = picker(single, 1, 0);
  expect({ actions: view.pagerActions, pager: view.pager, pages: view.pages.length }).toEqual({
    actions: [],
    pager: undefined,
    pages: 1,
  });
});
