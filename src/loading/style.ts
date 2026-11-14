import type { ProgressBarStyle } from "@andornaut/game-kit/progress";
import type { DomProgressTiming } from "@andornaut/game-kit/web/progress/dom/progressBar";

import palette from "../../public/art/palette.json" with { type: "json" };
import themes from "../../public/art/zone-themes.json" with { type: "json" };
import { LOADING_TIMING as LOADING_TIMING_DATA } from "../data/feedback.ts";
import { LOADING_LAYOUT } from "../data/layout.ts";
import { ZONE_MAP } from "../data/map.ts";
import { SCREEN } from "../data/screen.ts";
import { zoneTheme } from "../presentation/zoneTheme.ts";

export const PROGRESS_RECT = { height: LOADING_LAYOUT.height, width: SCREEN.width, x: 0, y: 0 };

export const LOADING_TIMING = LOADING_TIMING_DATA satisfies DomProgressTiming;

const styles = new Map<string, ProgressBarStyle>();

export function stageProgressStyle(stage = ZONE_MAP.start): ProgressBarStyle {
  const existing = styles.get(stage);
  if (existing) {
    return existing;
  }
  const colour = (name: string) => {
    const hex = (palette.colours as Readonly<Record<string, string>>)[name];
    if (!hex) {
      throw new Error(`Missing progress colour ${name}`);
    }
    return Number.parseInt(hex.slice(1), 16);
  };
  const track = colour("dslate");
  const style = {
    border: 0,
    fills: [colour(zoneTheme(ZONE_MAP, themes, stage).primary)],
    frame: track,
    track,
  };
  styles.set(stage, style);
  return style;
}
