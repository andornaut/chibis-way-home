import manifest from "../../public/art/manifest.json";
import moveSheet from "../../public/art/sprites/ui-move-hint.json";
import knobSheet from "../../public/art/sprites/ui-move-knob.json";
import jumpSheet from "../../public/art/sprites/ui-touch-jump.json";
import useSheet from "../../public/art/sprites/ui-touch-use.json";
import type { ControlAction } from "../data/types";
import { ART_PATH } from "./aseprite";

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

interface ControlSheet {
  readonly frames: Readonly<
    Record<
      string,
      {
        readonly frame: {
          readonly h: number;
          readonly w: number;
          readonly x: number;
          readonly y: number;
        };
        readonly sourceSize: { readonly h: number; readonly w: number };
      }
    >
  >;
  readonly meta: {
    readonly frameTags: readonly { readonly from: number; readonly name: string }[];
    readonly size: { readonly h: number; readonly w: number };
  };
}

export interface ActionHelpIcon {
  readonly frame: string;
  readonly height: number;
  readonly key: string;
  readonly png: string;
  readonly sheetHeight: number;
  readonly sheetWidth: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

function restIcon(key: string, sheet: ControlSheet): ActionHelpIcon {
  const rest = sheet.meta.frameTags.find((tag) => tag.name === "rest");
  const frame = rest && Object.keys(sheet.frames)[rest.from];
  const image = manifest.sprites.find((entry) => entry.key === key);
  const data = frame && sheet.frames[frame];
  if (
    !frame ||
    !data ||
    !image ||
    data.frame.w !== data.sourceSize.w ||
    data.frame.h !== data.sourceSize.h
  ) {
    throw new Error(`Missing full rest frame for ${key}`);
  }
  return {
    frame,
    height: data.sourceSize.h,
    key,
    png: ART_PATH + image.png,
    sheetHeight: sheet.meta.size.h,
    sheetWidth: sheet.meta.size.w,
    width: data.sourceSize.w,
    x: data.frame.x,
    y: data.frame.y,
  };
}

export const ACTION_HELP_ICONS: Readonly<Record<ControlAction, ActionHelpIcon>> = {
  jump: restIcon("ui-touch-jump", jumpSheet),
  move: restIcon("ui-move-hint", moveSheet),
  use: restIcon("ui-touch-use", useSheet),
};
export const ACTION_HELP_KNOB = restIcon("ui-move-knob", knobSheet);
