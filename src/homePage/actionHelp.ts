import type { ControlAction } from "../data/types";
import { ACTION_HELP } from "../layout/actionHelp";
import {
  ACTION_HELP_ICONS,
  ACTION_HELP_KNOB,
  type ActionHelpIcon,
  actionHelpParts,
} from "../view/actionHelp";

export const escaped = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

function spriteCss(name: string, scale: number, icon: ActionHelpIcon): string {
  const style = [
    `width:${icon.width * scale}px`,
    `height:${icon.height * scale}px`,
    `background-image:url('${icon.png}')`,
    `background-size:${icon.sheetWidth * scale}px ${icon.sheetHeight * scale}px`,
    `background-position:${-icon.x * scale}px ${-icon.y * scale}px`,
  ].join(";");
  return `.action-help-${name}{${style}}`;
}

export function actionHelpCss(): string {
  const faces = (Object.keys(ACTION_HELP_ICONS) as ControlAction[]).map((action) => {
    const face = ACTION_HELP_ICONS[action];
    return spriteCss(action, ACTION_HELP.icon / face.width, face);
  });
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
      position:relative;
      display:inline-block;
      width:${ACTION_HELP.icon}px;
      height:${ACTION_HELP.icon}px;
    }
    .action-help-sprite { display:block; image-rendering:pixelated; }
    .action-help-knob { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); }
    ${[...faces, spriteCss("knob-frame", ACTION_HELP.icon / ACTION_HELP_ICONS.move.width, ACTION_HELP_KNOB)].join("\n")}
  `;
}

export function actionHelpHtml(
  actions: Readonly<Record<ControlAction, string>>,
  text: string,
): string {
  return actionHelpParts(text)
    .map((part) => {
      if (part.kind === "text") {
        return escaped(part.text);
      }
      const knob =
        part.action === "move"
          ? '<span class="action-help-knob"><span class="action-help-sprite action-help-knob-frame"></span></span>'
          : "";
      return [
        `<span class="action-help-action"><span>${escaped(actions[part.action])}</span>`,
        '<span class="action-help-icon" aria-hidden="true">',
        `<span class="action-help-sprite action-help-${part.action}"></span>${knob}`,
        "</span></span>",
      ].join("");
    })
    .join("");
}
