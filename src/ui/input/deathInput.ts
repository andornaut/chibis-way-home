import { focusKeyAction, stepFocus } from "../focus";

export type DeathAction = "home" | "retry";
export const DEATH_ACTIONS: readonly DeathAction[] = ["retry", "home"];

// Retry is the safe default. Back, Escape and P cannot dismiss this required card.
export function deathKeyAction(
  focus: DeathAction | undefined,
  event: Pick<KeyboardEvent, "key" | "repeat" | "shiftKey">,
): { readonly focus: DeathAction | undefined; readonly action: DeathAction | undefined } {
  const action = focusKeyAction(event.key, event.shiftKey, event.repeat);
  if (action === "next" || action === "previous") {
    return { action: undefined, focus: stepFocus(DEATH_ACTIONS, focus, action) };
  }
  return { action: action === "press" ? (focus ?? "retry") : undefined, focus };
}
