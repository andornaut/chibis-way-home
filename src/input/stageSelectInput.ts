import { focusKeyAction, stepFocus } from "../pause/focusInput";

// Highlighting the latest stage does not activate it. A new navigation press must focus an
// action before Enter/Space can choose; the key that opened the modal cannot choose a stage.
export function stageSelectKey(
  latest: string,
  stages: readonly string[],
  focus: string | undefined,
  event: Pick<KeyboardEvent, "key" | "repeat" | "shiftKey">,
): {
  readonly close: boolean;
  readonly focus: string | undefined;
  readonly stage: string | undefined;
} {
  if (event.key === "Escape" && !event.repeat) {
    return { close: true, focus, stage: undefined };
  }
  const action = focusKeyAction(event.key, event.shiftKey, event.repeat);
  if (action === "next" || action === "previous") {
    return {
      close: false,
      focus: focus === undefined ? latest : stepFocus([...stages, "close"], focus, action),
      stage: undefined,
    };
  }
  return {
    close: action === "press" && focus === "close",
    focus,
    stage: action === "press" && focus !== undefined && stages.includes(focus) ? focus : undefined,
  };
}
