import { expect, it, vi } from "vitest";

import { SPEAKERS } from "../data/dialogues.ts";
import { ZONE_MAP } from "../data/map.ts";
import { STAGE_BARKS } from "../data/stageBarks.ts";
import { TEXT } from "../data/text.ts";
import type { StageBarkSchedule } from "../data/types/index.ts";
import { dialogueParagraphs } from "../ui/index.ts";
import { createStageBarks } from "./stageBarks.ts";

const first = { line: "first", speaker: "speaker" };
const later = { line: "later", speaker: "speaker" };
const schedule: StageBarkSchedule = {
  stage: [
    { atProgress: 0.25, id: "first", line: first },
    { atProgress: 0.75, id: "later", line: later },
  ],
};

it("retains presented lines across retry while unshown lines requalify at current progress", () => {
  const run = createStageBarks(schedule, "stage");
  const starts: (() => void)[] = [];
  const offer = vi.fn((onStart: () => void) => {
    starts.push(onStart);
    return true;
  });
  expect(run.offer(offer, 0.5)).toBe(true);
  starts.at(-1)!();
  expect(run.offer(offer, 0)).toBe(false);
  expect(run.offer(offer, 0.5)).toBe(false);
  expect(run.offer(offer, 0.8)).toBe(true);
  expect(offer.mock.calls[1]![0]).not.toBe(offer.mock.calls[0]![0]);
  // A retry discards the unshown queue entry without acknowledging it.

  expect(run.offer(offer, 0)).toBe(false);
  expect(run.offer(offer, 0.8)).toBe(true);
  starts.at(-1)!();
  expect(run.offer(offer, 1)).toBe(false);
});
it("does not acknowledge a busy presentation and starts fresh only for a new generated run", () => {
  const run = createStageBarks(schedule, "stage");
  expect(run.offer(() => false, 0.5)).toBe(false);
  const play = vi.fn((onStart: () => void) => {
    onStart();
    return true;
  });
  expect(run.offer(play, 0.5)).toBe(true);
  expect(run.offer(play, 0.5)).toBe(false);
  expect(createStageBarks(schedule, "stage").offer(play, 0.5)).toBe(true);
  expect(createStageBarks(schedule, "unassigned").offer(play, 1)).toBe(false);
});
it.each([
  {
    events: [
      { atProgress: 0.2, id: "same", line: first },
      { atProgress: 0.4, id: "same", line: later },
    ],
  },
  { events: [{ atProgress: Number.NaN, id: "first", line: first }] },
])("rejects ambiguous or invalid schedules", ({ events }) => {
  expect(() => createStageBarks({ stage: events }, "stage")).toThrow("Invalid stage bark");
});

it("offers the authored registry against real stage IDs and resolves each dialogue line", () => {
  const stages = new Set(ZONE_MAP.destinations.flatMap(({ stages }) => stages));
  for (const [stage, events] of Object.entries(STAGE_BARKS)) {
    expect(stages.has(stage)).toBe(true);
    const run = createStageBarks(STAGE_BARKS, stage);
    for (const event of events) {
      const present = vi.fn((onStart: () => void, line: typeof event.line) => {
        expect(line).toEqual(event.line);
        expect(dialogueParagraphs(SPEAKERS, TEXT, { lines: [line] })).toHaveLength(1);
        onStart();
        return true;
      });
      expect(run.offer(present, event.atProgress)).toBe(true);
      expect(present).toHaveBeenCalledOnce();
    }
  }
});
