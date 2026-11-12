import { stepFocus } from "../focus/index.ts";

export type MapAction = "continue" | "home";
type MapKeyAction =
  | { readonly kind: "activate"; readonly target: MapAction }
  | { readonly kind: "focus"; readonly target: MapAction | undefined }
  | { readonly kind: "step"; readonly by: -1 | 1 };

// Continue stays the first focused action although it is drawn to the right of Back to title.
export const MAP_ACTIONS: readonly MapAction[] = ["continue", "home"];
const STEP_KEYS: Readonly<Record<string, -1 | 1>> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  KeyA: -1,
  KeyD: 1,
};
const CONTINUE_KEYS = ["ArrowUp", "KeyE", "KeyW"];

// Left/Right and A/D retain map navigation. Tab selects footer actions; Enter/Space use the
// focused action or safely default to Continue. Held activation keys never activate twice.
export function mapKeyAction(
  focus: MapAction | undefined,
  { code, repeat, shiftKey }: Pick<KeyboardEvent, "code" | "repeat" | "shiftKey">,
): MapKeyAction | undefined {
  if (code === "Tab") {
    return { kind: "focus", target: stepFocus(MAP_ACTIONS, focus, shiftKey ? "previous" : "next") };
  }
  const by = STEP_KEYS[code];
  if (by !== undefined) {
    return { by, kind: "step" };
  }
  if (repeat) {
    return undefined;
  }
  if (["Enter", "Space"].includes(code)) {
    return { kind: "activate", target: focus ?? "continue" };
  }
  return CONTINUE_KEYS.includes(code) ? { kind: "activate", target: "continue" } : undefined;
}
