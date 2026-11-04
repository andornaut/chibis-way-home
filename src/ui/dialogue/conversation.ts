import type { BitmapFont } from "@andornaut/game-kit/text/bitmapFont";
import { bitmapMeasure, fitsRoom, fittingText } from "@andornaut/game-kit/text/textFit";

import type {
  DialogueChoice,
  DialoguePlan,
  DialogueSpeaker,
  GameText,
  Point,
} from "../../data/types";
import { focusKeyAction, stepFocus } from "../focus";
import { type PressArea, pressedArea } from "../layout/hitAreas";

export interface DialogueParagraph {
  readonly colour: DialogueSpeaker["colour"];
  readonly name: string;
  readonly portrait: string | null;
  readonly side: DialogueSpeaker["side"];
  readonly text: string;
}

// Resolve one linear conversation before showing it, so missing words or speakers fail together.
export function dialogueParagraphs(
  speakers: Readonly<Record<string, DialogueSpeaker>>,
  text: Pick<GameText, "dialogue" | "lines">,
  plan: DialoguePlan,
): readonly DialogueParagraph[] {
  if (plan.lines.length === 0) {
    throw new Error("A dialogue needs at least one paragraph");
  }
  return plan.lines.map(({ line, speaker }) => {
    const who = speakers[speaker];
    const name = text.dialogue.speakers[speaker];
    const paragraph = text.lines[line];
    if (!who || !name?.trim() || !paragraph?.trim()) {
      throw new Error(`Incomplete dialogue paragraph ${line} by ${speaker}`);
    }
    return { ...who, name, text: paragraph };
  });
}

// Wrap at the fixed font size. A paragraph outside its room is rejected rather than shrunk.
export function dialogueLines(
  font: BitmapFont,
  style: { readonly lines: number; readonly scale: number },
  width: number,
  text: string,
): readonly string[] {
  const measure = bitmapMeasure(font);
  const fitted = fittingText(style, measure, width, text);
  if (!fitsRoom(measure, width, fitted)) {
    throw new Error("Dialogue paragraph does not fit its text area");
  }
  return fitted.lines;
}

export type DialogueControl = "continue" | "skip";
export type DialogueAction = "advance" | "nextFocus" | "previousFocus" | "skip";

// Explicit focus navigation selects between Continue and Skip. Enter without focus advances.
export function dialogueKeyAction(
  focus: DialogueControl | undefined,
  { key, repeat, shiftKey }: Pick<KeyboardEvent, "key" | "repeat" | "shiftKey">,
): DialogueAction | undefined {
  if (repeat || ["Alt", "Control", "Meta", "Shift"].includes(key)) {
    return undefined;
  }
  if (key === "Tab") {
    return shiftKey ? "previousFocus" : "nextFocus";
  }
  if (["ArrowDown", "ArrowRight"].includes(key)) {
    return "nextFocus";
  }
  if (["ArrowUp", "ArrowLeft"].includes(key)) {
    return "previousFocus";
  }
  return focus === "skip" && ["Enter", " "].includes(key) ? "skip" : "advance";
}

export interface DialoguePress {
  readonly at: Point;
  readonly cancelled: boolean;
  readonly id: number;
  readonly control: DialogueControl | undefined;
}

// Leaving the tap radius cancels the press even when it later returns to its starting point.
export function moveDialoguePress(
  tapDistance: number,
  at: Point,
  press: DialoguePress,
): DialoguePress {
  return {
    ...press,
    cancelled: press.cancelled || Math.hypot(at.x - press.at.x, at.y - press.at.y) > tapDistance,
  };
}

// A fresh completed tap advances. A button must be pressed and released on the same action.
export function dialogueTapAction(
  controls: readonly PressArea<DialogueControl>[],
  tapDistance: number,
  press: DialoguePress | undefined,
  pointer: Point & { readonly id: number; readonly wasCanceled: boolean },
): "advance" | "skip" | undefined {
  if (!press || pointer.id !== press.id || pointer.wasCanceled) {
    return undefined;
  }
  if (moveDialoguePress(tapDistance, pointer, press).cancelled) {
    return undefined;
  }
  const released = pressedArea(controls, pointer);
  if (released !== press.control) {
    return undefined;
  }
  return released === "skip" ? "skip" : "advance";
}

export interface ResolvedDialogueChoice {
  readonly options: readonly { readonly id: string; readonly label: string }[];
  readonly prompt: string;
}

// A terminal choice has two or three explicit answers, with no default or implicit effects.
export function dialogueChoice(
  lines: Readonly<Record<string, string>>,
  choice: DialogueChoice,
): ResolvedDialogueChoice {
  const prompt = lines[choice.prompt];
  const ids = choice.options.map(({ id }) => id);
  if (
    !prompt?.trim() ||
    choice.options.length < 2 ||
    choice.options.length > 3 ||
    ids.some((id) => !id.trim()) ||
    new Set(ids).size !== ids.length
  ) {
    throw new Error("Invalid terminal dialogue choice");
  }
  return {
    options: choice.options.map(({ id, label }) => {
      const words = lines[label];
      if (!words?.trim()) {
        throw new Error(`Missing dialogue choice label ${label}`);
      }
      return { id, label: words };
    }),
    prompt,
  };
}

// A required choice never selects an answer until it has been explicitly focused and activated.
export function dialogueChoiceKey(
  ids: readonly string[],
  focus: string | undefined,
  event: Pick<KeyboardEvent, "key" | "repeat" | "shiftKey">,
): { readonly focus: string | undefined; readonly selection: string | undefined } {
  const action = focusKeyAction(event.key, event.shiftKey, event.repeat);
  if (action === "next" || action === "previous") {
    return { focus: stepFocus(ids, focus, action), selection: undefined };
  }
  return {
    focus,
    selection: action === "press" && focus !== undefined && ids.includes(focus) ? focus : undefined,
  };
}

// Skip and the last paragraph reach the same terminal state. A choice is returned for display,
// never converted into an answer or a completed conversation.
export function dialogueProgress(
  choice: DialogueChoice | undefined,
  paragraphCount: number,
  index: number,
  action: "advance" | "skip",
):
  | { readonly kind: "paragraph"; readonly index: number }
  | { readonly kind: "choice"; readonly choice: DialogueChoice }
  | { readonly kind: "complete" } {
  if (action === "advance" && index + 1 < paragraphCount) {
    return { index: index + 1, kind: "paragraph" };
  }
  return choice === undefined ? { kind: "complete" } : { choice, kind: "choice" };
}
