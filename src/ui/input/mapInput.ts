export type MapAction = "continue" | "home";
export const MAP_ACTIONS: readonly MapAction[] = ["continue", "home"];
const STEP_KEYS: Readonly<Record<string, -1 | 1>> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  KeyA: -1,
  KeyD: 1,
  KeyH: -1,
  KeyL: 1,
};

// Only horizontal destination traversal stays local. The document owner handles UI keys.
export function mapKeyAction({
  code,
}: Pick<KeyboardEvent, "code">): { readonly kind: "step"; readonly by: -1 | 1 } | undefined {
  const by = STEP_KEYS[code];
  return by === undefined ? undefined : { by, kind: "step" };
}
