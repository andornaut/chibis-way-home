import type { ProgressBarStyle } from "@andornaut/game-kit/progress";
import type { DomProgressTiming } from "@andornaut/game-kit/web/progress/dom/progressBar";

import palette from "../../public/art/palette.json";
import themes from "../../public/art/zone-themes.json";
import { DEATH_CARD } from "../data/layout";
import { ZONE_MAP } from "../data/map";
import { SCREEN } from "../data/screen";
import { zoneTheme } from "../presentation/zoneTheme";

export const PROGRESS_RECT = { height: DEATH_CARD.progressHeight, width: SCREEN.width, x: 0, y: 0 };

// The bar's motion: the pending segment, a quarter of the track, crosses it every 1.5 s, and a
// measured load that finishes holds full for 250 ms, then fades out over 150 ms and hides. Reduced
// motion keeps the fade.
export const LOADING_TIMING = {
  cycleMs: 1500,
  fadeMs: 150,
  fullMs: 250,
  segment: 0.25,
} satisfies DomProgressTiming;

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
