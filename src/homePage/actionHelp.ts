import palette from "../../public/art/palette.json";
import type { ControlAction } from "../data/types";
import { ACTION_HELP } from "../layout/actionHelp";
import { actionHelpParts } from "../view/actionHelp";
import { helpChromeSvg } from "../view/helpChrome";

export const escaped = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

export function actionHelpCss(): string {
  return `
    .action-help-action {
      display:inline-flex;
      min-height:${ACTION_HELP.lineHeight}px;
      align-items:center;
      gap:${ACTION_HELP.gap}px;
      vertical-align:middle;
      white-space:nowrap;
    }
    .action-help-icon {
      display:inline-block;
      flex:0 0 ${ACTION_HELP.icon}px;
      width:${ACTION_HELP.icon}px;
      height:${ACTION_HELP.icon}px;
    }
    .action-help-icon svg { display:block; image-rendering:auto; }
  `;
}

const colours = {
  cream: parseInt(palette.colours.cream.slice(1), 16),
  ink: parseInt(palette.colours.ink.slice(1), 16),
  navy: parseInt(palette.colours.navy.slice(1), 16),
  white: parseInt(palette.colours.white.slice(1), 16),
};

export function actionHelpHtml(
  actions: Readonly<Record<ControlAction, string>>,
  text: string,
): string {
  return actionHelpParts(text)
    .map((part) => {
      if (part.kind === "text") {
        return escaped(part.text);
      }
      return [
        `<span class="action-help-action"><span>${escaped(actions[part.action])}</span>`,
        `<span class="action-help-icon action-help-${part.action}" aria-hidden="true">`,
        helpChromeSvg(colours, ACTION_HELP.icon, part.action),
        "</span></span>",
      ].join("");
    })
    .join("");
}
