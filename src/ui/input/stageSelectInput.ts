import { focusKeyAction, stepFocus } from "../focus/index.ts";

// Highlighting the latest stage does not activate it. A new navigation press must focus an
// action before Enter/Space can choose; the key that opened the modal cannot choose a stage. A
// focused enabled page control turns the page.
export function stagePickerKey(
  context: {
    readonly focus: string | undefined;
    readonly latest: string;
    readonly pages: readonly ("previousPage" | "nextPage")[];
    readonly stages: readonly string[];
  },
  event: Pick<KeyboardEvent, "key" | "repeat" | "shiftKey">,
): {
  readonly close: boolean;
  readonly focus: string | undefined;
  readonly page?: -1 | 1;
  readonly stage: string | undefined;
} {
  const { focus, latest, pages, stages } = context;
  if (event.key === "Escape" && !event.repeat) {
    return { close: true, focus, stage: undefined };
  }
  const action = focusKeyAction(event.key, event.shiftKey, event.repeat);
  if (action === "next" || action === "previous") {
    return {
      close: false,
      focus:
        focus === undefined ? latest : stepFocus([...stages, ...pages, "close"], focus, action),
      stage: undefined,
    };
  }
  const page =
    action === "press" && pages.includes(focus as "previousPage" | "nextPage")
      ? focus === "previousPage"
        ? -1
        : 1
      : undefined;
  return {
    ...(page !== undefined && { page }),
    close: action === "press" && focus === "close",
    focus,
    stage: action === "press" && focus !== undefined && stages.includes(focus) ? focus : undefined,
  };
}
