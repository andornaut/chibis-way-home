import type { ProgressBarStyle } from "@andornaut/game-kit/progress";

import palette from "../../public/art/palette.json";
import themes from "../../public/art/zone-themes.json";
import { DEATH_CARD } from "../data/layout";
import { ZONE_MAP } from "../data/map";
import { SCREEN } from "../data/screen";
import { zoneTheme } from "../presentation/zoneTheme";

export const PROGRESS_RECT = { height: DEATH_CARD.progressHeight, width: SCREEN.width, x: 0, y: 0 };

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
