import { inkWidth, parseBitmapFont } from "@andornaut/game-kit/text/bitmapFont";
import { describe, expect, it } from "vitest";

import fontBody from "../../../public/art/fonts/font-body.fnt?raw";
import { TOUCH } from "../../data/touch";
import type { DialoguePlan, DialogueSpeaker, GameText } from "../../data/types";
import { DIALOGUE_SCREEN } from "../layout/dialogueScreen";
import {
  dialogueChoice,
  dialogueChoiceKey,
  dialogueKeyAction,
  dialogueLines,
  dialogueParagraphs,
  type DialoguePress,
  dialogueProgress,
  dialogueTapAction,
  moveDialoguePress,
} from "./conversation";

const speakers: Readonly<Record<string, DialogueSpeaker>> = {
  dog: { colour: "amber", portrait: "portrait-dog", side: "right" },
};
const text: Pick<GameText, "dialogue" | "lines"> = {
  dialogue: { continue: "Continue", skip: "Skip", speakers: { dog: "Dog" } },
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

describe("dialogueLines", () => {
  const font = parseBitmapFont(fontBody);
  const style = DIALOGUE_SCREEN.text;

  it.each([style.lines, style.lines + 1])("keeps the fixed font size for %i lines", (count) => {
    const paragraph = Array.from({ length: count }, () => text.lines.greeting).join("\n");
    const fit = () => dialogueLines(font, style, style.width, paragraph);
    if (count > style.lines) {
      expect(fit).toThrow("does not fit");
    } else {
      expect(fit()).toEqual(paragraph.split("\n"));
    }
  });

  it("wraps by measured ink width and rejects an unbreakable word wider than the panel", () => {
    const wide = "W".repeat(Math.ceil(style.width / inkWidth(font, style.scale, "W")) + 1);
    expect(() => dialogueLines(font, style, style.width, wide)).toThrow("does not fit");
    const paragraph = Array.from({ length: 25 }, () => text.lines.greeting).join(" ");
    const lines = dialogueLines(font, { ...style, lines: 100 }, style.width, paragraph);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.every((line) => inkWidth(font, style.scale, line) <= style.width)).toBe(true);
  });
});

describe("dialogueKeyAction", () => {
  it.each([
    { action: "advance", focus: undefined, key: "Enter", repeat: false },
    { action: "advance", focus: undefined, key: "p", repeat: false },
    { action: "advance", focus: undefined, key: "Escape", repeat: false },
    { action: "nextFocus", focus: undefined, key: "Tab", repeat: false },
    { action: "nextFocus", focus: undefined, key: "ArrowRight", repeat: false },
    { action: "skip", focus: "skip", key: "Enter", repeat: false },
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

  it.each(["advance", "skip"] as const)(
    "%s at the last paragraph opens a required choice",
    (action) => {
      expect(dialogueProgress(choice, plan.lines.length, plan.lines.length - 1, action)).toEqual({
        choice,
        kind: "choice",
      });
      expect(dialogueProgress(undefined, plan.lines.length, plan.lines.length - 1, action)).toEqual(
        { kind: "complete" },
      );
    },
  );

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
