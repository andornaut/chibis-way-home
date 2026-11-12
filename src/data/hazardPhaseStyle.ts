import { HAZARD_OUTLINE } from "./screen.ts";

export const HAZARD_PHASE_STYLE = {
  active: "red",
  inactive: "dslate",
  warning: "amber",
  warningWidth: HAZARD_OUTLINE.width,
} as const;
