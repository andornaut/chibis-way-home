import { ZONE_MAP } from "./map.ts";

export const STAGE_PREVIEWS: Readonly<Record<string, string>> = Object.fromEntries(
  ZONE_MAP.destinations.flatMap(({ stages }, zoneIndex) =>
    stages.map((stage, stageIndex) => [
      stage,
      `stage-preview-zone-${zoneIndex + 1}-stage-${stageIndex + 1}`,
    ]),
  ),
);
