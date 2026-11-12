import { fillNames } from "@andornaut/game-kit/lines";
import type { BitmapFont } from "@andornaut/game-kit/text/bitmapFont";
import { bitmapMeasure, fitsRoom, fittingText } from "@andornaut/game-kit/text/textFit";

import { CARD_CONTENT } from "../../data/layout.ts";
import { SCREEN } from "../../data/screen.ts";
import { timeText } from "../../progress/index.ts";
import { CARD_TEXT_SCALE } from "./cardFrame.ts";

export const RUN_STAT_KEYS = ["attempts", "lastAttempt", "best"] as const;
// The current stage's metrics in the order a statistics column shows them.
export const STAGE_METRICS = ["lastAttempt", "best", "attempts"] as const;
export interface StatsMetricRow {
  readonly label: string;
  readonly value: string;
}
type RunStatWords = Readonly<Record<(typeof RUN_STAT_KEYS)[number], string>>;

export interface StatsTotalsSnapshot {
  readonly stageSeconds: number;
  readonly zoneSeconds: number;
  readonly runSeconds: number;
}

export function statsTotalRows(
  templates: Readonly<Record<"stageTotal" | "zoneTotal" | "runTotal", string>>,
  totals: StatsTotalsSnapshot,
): readonly { readonly label: string; readonly value: string }[] {
  return (
    [
      ["stageTotal", totals.stageSeconds],
      ["zoneTotal", totals.zoneSeconds],
      ["runTotal", totals.runSeconds],
    ] as const
  ).map(([key, seconds]) => ({
    label: fillNames(templates[key], { time: "" }).trimEnd(),
    value: timeText(seconds),
  }));
}

export function wrappedCardText(font: BitmapFont, width: number, text: string): string {
  const measure = bitmapMeasure(font);
  const fitted = fittingText(
    { lines: Math.floor(SCREEN.height / CARD_CONTENT.lineHeight), scale: CARD_TEXT_SCALE },
    measure,
    width,
    text,
  );
  if (!fitsRoom(measure, width, fitted)) {
    throw new Error(`Text cannot fit ${width}px: ${text}`);
  }
  return fitted.lines.join("\n");
}

export function runStatLabels(templates: RunStatWords): RunStatWords {
  return Object.fromEntries(
    RUN_STAT_KEYS.map((key) => {
      const start = templates[key].indexOf("{");
      if (start < 0) {
        throw new Error(`Missing metric placeholder: ${key}`);
      }
      return [key, templates[key].slice(0, start).trimEnd()];
    }),
  ) as unknown as RunStatWords;
}
