import { describe, expect, it } from "vitest";

import { stageSelectKey } from "./stageSelectInput";

const STAGES = ["one", "two", "three"];
const LATEST = STAGES.at(-1)!;

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
