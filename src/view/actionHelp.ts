import type { ControlAction } from "../data/types";

export type ActionHelpPart =
  | { readonly kind: "text"; readonly text: string }
  | { readonly action: ControlAction; readonly kind: "action" };

export function actionHelpParts(text: string): readonly ActionHelpPart[] {
  const parts: ActionHelpPart[] = [];
  let start = 0;
  for (const match of text.matchAll(/\{([^{}]+)\}/gu)) {
    if (match.index > start) {
      parts.push({ kind: "text", text: text.slice(start, match.index) });
    }
    const action = match[1];
    if (action !== "move" && action !== "jump" && action !== "use") {
      throw new Error(`Unknown action help token ${action}`);
    }
    parts.push({ action, kind: "action" });
    start = match.index + match[0].length;
  }
  if (start < text.length) {
    parts.push({ kind: "text", text: text.slice(start) });
  }
  return parts;
}
