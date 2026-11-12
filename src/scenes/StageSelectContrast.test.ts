// @vitest-environment happy-dom
import { expect, it } from "vitest";

import { ZONE_MAP } from "../data/map.ts";
import { TEXT } from "../data/text.ts";
import { createStageSelect, STAGES_PER_PAGE } from "../ui/index.ts";

const destination = ZONE_MAP.destinations.find(({ stages }) => stages.length === 6)!;

// Each look's colours and fades are stageSelect.css's; contrast.test.ts holds a locked stage's
// labels at 4.5:1.
it("keeps every unlocked stage in a legible look on both Apartment pages, dimming only locked ones", () => {
  const latest = destination.stages[3]!;
  const unlocked = destination.stages.slice(0, 4);
  const view = createStageSelect(
    document,
    { close: "", locked: "", pager: TEXT.map.stagePages, title: "" },
    STAGES_PER_PAGE,
    destination.stages.map((id) => ({
      id,
      look: !unlocked.includes(id) ? "locked" : id === latest ? "primary" : "normal",
      name: TEXT.map.stages[id]!,
      number: "",
    })),
  );
  expect(
    view.pages.map((page) => [...page.children].map((face) => (face as HTMLElement).dataset.look)),
  ).toEqual([
    ["normal", "normal", "normal"],
    ["primary", "locked", "locked"],
  ]);
});
