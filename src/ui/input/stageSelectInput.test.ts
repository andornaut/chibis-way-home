import { describe, expect, it } from "vitest";

import { stagePickerKey } from "./stageSelectInput";

const STAGES = ["one", "two", "three"];
const LATEST = STAGES.at(-1)!;
// A single-page picker.
const stageSelectKey = (
  latest: string,
  stages: readonly string[],
  focus: string | undefined,
  event: Pick<KeyboardEvent, "key" | "repeat" | "shiftKey">,
) => stagePickerKey({ focus, latest, pages: [], stages }, event);

describe("stage-picker input", () => {
  it.each(["Enter", " "])("does not auto-select through the opening %s key", (key) => {
    expect(
      stageSelectKey(LATEST, STAGES, undefined, { key, repeat: false, shiftKey: false }).stage,
    ).toBeUndefined();
    expect(
      stageSelectKey(LATEST, STAGES, LATEST, { key, repeat: true, shiftKey: false }).stage,
    ).toBeUndefined();
  });
  it("focuses the latest reached stage first, then permits explicit replay of an earlier stage", () => {
    const tab = { key: "Tab", repeat: false, shiftKey: false };
    const first = stageSelectKey(LATEST, STAGES, undefined, tab);
    expect(first.focus).toBe(LATEST);
    expect(first.stage).toBeUndefined();
    const earlier = stageSelectKey(LATEST, STAGES, first.focus, { ...tab, key: "ArrowLeft" });
    expect(earlier.focus).toBe(STAGES.at(-2));
    expect(stageSelectKey(LATEST, STAGES, earlier.focus, { ...tab, key: "Enter" }).stage).toBe(
      STAGES.at(-2),
    );
  });
  it("skips locked cards for navigation and activation", () => {
    const unlocked = STAGES.slice(0, 2);
    const event = { key: "Enter", repeat: false, shiftKey: false };
    expect(stageSelectKey(unlocked.at(-1)!, unlocked, STAGES[2], event).stage).toBeUndefined();
    expect(
      stageSelectKey(unlocked.at(-1)!, unlocked, unlocked.at(-1), { ...event, key: "Tab" }).focus,
    ).toBe("close");
  });
  it("Escape and focused close return to the map without choosing a stage", () => {
    expect(
      stageSelectKey(LATEST, STAGES, undefined, { key: "Escape", repeat: false, shiftKey: false }),
    ).toEqual({ close: true, focus: undefined, stage: undefined });
    expect(
      stageSelectKey(LATEST, STAGES, "close", { key: "Enter", repeat: false, shiftKey: false }),
    ).toEqual({ close: true, focus: "close", stage: undefined });
  });
});

describe("stage-picker page controls", () => {
  it.each([
    { focus: "nextPage", page: 1, pages: ["nextPage"] as const },
    { focus: "previousPage", page: -1, pages: ["previousPage"] as const },
    { focus: "nextPage", page: undefined, pages: [] as const },
  ])("activates $focus only when enabled, yielding $page", ({ focus, page, pages }) => {
    expect(
      stagePickerKey(
        { focus, latest: LATEST, pages, stages: STAGES },
        { key: "Enter", repeat: false, shiftKey: false },
      ),
    ).toMatchObject({ close: false, stage: undefined });
    expect(
      stagePickerKey(
        { focus, latest: LATEST, pages, stages: STAGES },
        { key: "Enter", repeat: false, shiftKey: false },
      ).page,
    ).toBe(page);
  });
  it("focuses the next page after the last available stage without activating it on repeats", () => {
    const context = { focus: LATEST, latest: LATEST, pages: ["nextPage"] as const, stages: STAGES };
    expect(stagePickerKey(context, { key: "Tab", repeat: false, shiftKey: false }).focus).toBe(
      "nextPage",
    );
    expect(
      stagePickerKey(
        { ...context, focus: "nextPage" },
        { key: "Enter", repeat: true, shiftKey: false },
      ).page,
    ).toBeUndefined();
  });
});
