import { describe, expect, it } from "vitest";

import { TOUCH } from "../../data/touch.ts";
import type { DialoguePlan, DialogueSpeaker, GameText } from "../../data/types/index.ts";
import {
  dialogueChoice,
  dialogueChoiceKey,
  dialogueKeyAction,
  dialogueParagraphs,
  type DialoguePress,
  dialogueProgress,
  dialogueSkipAvailable,
  dialogueTapAction,
  moveDialoguePress,
} from "./conversation.ts";

const speakers: Readonly<Record<string, DialogueSpeaker>> = {
  dog: { colour: "amber", portrait: "portrait-dog", side: "right" },
};
const text: Pick<GameText, "dialogue" | "lines"> = {
  dialogue: {
    continue: "Continue",
    label: "Talk",
    previous: "Previous",
    skip: "Skip",
    speakers: { dog: "Dog" },
  },
  lines: { greeting: "Stop there." },
};
const plan: DialoguePlan = { lines: [{ line: "greeting", speaker: "dog" }] };

describe("dialogueParagraphs", () => {
  it("preserves an explicit neutral portrait instead of borrowing another speaker asset", () => {
    expect(
      dialogueParagraphs({ dog: { ...speakers.dog!, portrait: null } }, text, plan)[0]?.portrait,
    ).toBeNull();
  });

  it("resolves paragraphs in their written order", () => {
    expect(dialogueParagraphs(speakers, text, { lines: [...plan.lines, ...plan.lines] })).toEqual(
      Array.from({ length: plan.lines.length * 2 }, () => ({
        ...speakers.dog,
        name: text.dialogue.speakers.dog,
        text: text.lines.greeting,
      })),
    );
  });

  it.each(["empty plan", "missing speaker", "missing name", "missing paragraph"])(
    "rejects %s before showing the conversation",
    (invalid) => {
      const words = {
        ...text,
        ...(invalid === "missing paragraph" ? { lines: {} } : {}),
        dialogue: {
          ...text.dialogue,
          ...(invalid === "missing name" ? { speakers: {} } : {}),
        },
      };
      expect(() =>
        dialogueParagraphs(
          invalid === "missing speaker" ? {} : speakers,
          words,
          invalid === "empty plan" ? { lines: [] } : plan,
        ),
      ).toThrow();
    },
  );
});

describe("dialogueKeyAction", () => {
  it.each([
    { action: "advance", focus: undefined, key: "Enter", repeat: false },
    { action: undefined, focus: undefined, key: "p", repeat: false },
    { action: undefined, focus: undefined, key: "Escape", repeat: false },
    { action: undefined, focus: undefined, key: "q", repeat: false },
    { action: undefined, focus: "skip", key: "q", repeat: false },
    { action: "nextFocus", focus: undefined, key: "Tab", repeat: false },
    { action: "nextFocus", focus: undefined, key: "ArrowRight", repeat: false },
    { action: "skip", focus: "skip", key: "Enter", repeat: false },
    { action: "previous", focus: "previous", key: "Enter", repeat: false },
    { action: "previous", focus: "previous", key: " ", repeat: false },
    { action: undefined, focus: "previous", key: "Enter", repeat: true },
    { action: "advance", focus: "continue", key: "Enter", repeat: false },
    { action: "skip", focus: "skip", key: " ", repeat: false },
    { action: undefined, focus: "skip", key: "Enter", repeat: true },
    { action: undefined, focus: undefined, key: "Shift", repeat: false },
  ] as const)(
    "$key with focus $focus and repeat $repeat: $action",
    ({ action, focus, key, repeat }) => {
      expect(dialogueKeyAction(focus, { key, repeat, shiftKey: false })).toBe(action);
    },
  );
});

describe("dialogueTapAction", () => {
  const hit = { height: 48, width: 80, x: 100, y: 0 };
  const controls = [{ art: hit, hit, key: "skip" as const }];
  const ordinary: DialoguePress = {
    at: { x: 10, y: 10 },
    cancelled: false,
    control: undefined,
    id: 1,
  };
  const skip: DialoguePress = { ...ordinary, at: { x: 120, y: 10 }, control: "skip" };
  const pointer = { id: ordinary.id, wasCanceled: false, ...ordinary.at };

  it.each([
    { action: "advance", name: "fresh ordinary tap", press: ordinary, release: pointer },
    { action: "skip", name: "fresh Skip tap", press: skip, release: { ...pointer, ...skip.at } },
    {
      action: undefined,
      name: "held pointer from before opening",
      press: undefined,
      release: pointer,
    },
    {
      action: undefined,
      name: "another finger",
      press: ordinary,
      release: { ...pointer, id: pointer.id + 1 },
    },
    {
      action: undefined,
      name: "cancelled touch",
      press: ordinary,
      release: { ...pointer, wasCanceled: true },
    },
    { action: undefined, name: "Skip press released outside", press: skip, release: pointer },
  ])("$name", ({ action, press, release }) => {
    expect(dialogueTapAction(controls, TOUCH.tapMaxDistance, press, release)).toBe(action);
  });

  it("does not advance when a drag returns to its starting point", () => {
    const dragged = moveDialoguePress(
      TOUCH.tapMaxDistance,
      { ...ordinary.at, x: ordinary.at.x + TOUCH.tapMaxDistance + 1 },
      ordinary,
    );
    expect(dialogueTapAction(controls, TOUCH.tapMaxDistance, dragged, pointer)).toBeUndefined();
  });
});

const choice = {
  options: [
    { id: "wait", label: "wait-label" },
    { id: "go", label: "go-label" },
  ],
  prompt: "question",
};
const choiceWords = { "go-label": "Go", question: "What now?", "wait-label": "Wait" };

describe("terminal dialogue choices", () => {
  it("resolves prompt and labels without inventing an answer", () => {
    expect(dialogueChoice(choiceWords, choice)).toEqual({
      options: [
        { id: "wait", label: choiceWords["wait-label"] },
        { id: "go", label: choiceWords["go-label"] },
      ],
      prompt: choiceWords.question,
    });
  });

  it.each([
    { ...choice, options: choice.options.slice(0, 1) },
    { ...choice, options: [...choice.options, ...choice.options] },
    { ...choice, options: [choice.options[0]!, choice.options[0]!] },
    { ...choice, prompt: "missing" },
    { ...choice, options: [choice.options[0]!, { id: "other", label: "missing" }] },
  ])("rejects incomplete or ambiguous choices", (invalid) => {
    expect(() => dialogueChoice(choiceWords, invalid)).toThrow();
  });

  it("the last Next opens a required choice or completes a linear conversation", () => {
    expect(dialogueProgress(choice, plan.lines.length, plan.lines.length - 1, "advance")).toEqual({
      choice,
      kind: "choice",
    });
    expect(
      dialogueProgress(undefined, plan.lines.length, plan.lines.length - 1, "advance"),
    ).toEqual({ kind: "complete" });
  });

  it.each([
    { count: 1, index: 0, name: "sole linear page", skip: false },
    { count: 3, index: 0, name: "first page", skip: true },
    { count: 3, index: 1, name: "middle page before final Next", skip: true },
    { count: 3, index: 2, name: "final page or next page is a fork", skip: false },
  ])("gates Skip on the current and immediate next Next: $name", ({ count, index, skip }) => {
    expect(dialogueSkipAvailable(count, index)).toBe(skip);
    if (!skip) {
      for (const terminal of [choice, undefined]) {
        expect(dialogueProgress(terminal, count, index, "skip")).toEqual({
          index,
          kind: "paragraph",
        });
      }
    }
  });

  it("Previous restores a paragraph without reaching the terminal choice or completing", () => {
    expect(dialogueProgress(choice, 3, 2, "previous")).toEqual({ index: 1, kind: "paragraph" });
    expect(dialogueProgress(undefined, 3, 2, "previous")).toEqual({ index: 1, kind: "paragraph" });
    expect(dialogueProgress(choice, 3, 0, "previous")).toEqual({ index: 0, kind: "paragraph" });
  });

  it("Skip reaches the required choice while Continue keeps the next paragraph", () => {
    const count = plan.lines.length + 1;
    expect(dialogueProgress(choice, count, 0, "advance")).toEqual({ index: 1, kind: "paragraph" });
    expect(dialogueProgress(choice, count, 0, "skip")).toEqual({ choice, kind: "choice" });
  });

  it.each([
    { focus: undefined, key: "Enter", repeat: false, selection: undefined, to: undefined },
    { focus: undefined, key: " ", repeat: false, selection: undefined, to: undefined },
    { focus: undefined, key: "Tab", repeat: false, selection: undefined, to: "wait" },
    { focus: "wait", key: "Enter", repeat: false, selection: "wait", to: "wait" },
    { focus: "wait", key: "Enter", repeat: true, selection: undefined, to: "wait" },
    { focus: "wait", key: "Escape", repeat: false, selection: undefined, to: "wait" },
    { focus: "wait", key: "p", repeat: false, selection: undefined, to: "wait" },
  ])(
    "$key with focus $focus selects only through explicit activation",
    ({ focus, key, repeat, selection, to }) => {
      expect(
        dialogueChoiceKey(
          choice.options.map(({ id }) => id),
          focus,
          { key, repeat, shiftKey: false },
        ),
      ).toEqual({ focus: to, selection });
    },
  );
});
