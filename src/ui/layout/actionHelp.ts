import { ACTION_HELP_LAYOUT, CARD_CONTENT } from "../../data/layout.ts";

// The label-to-icon gap shared by every action help, and the home page's HTML icon and line box.
export const ACTION_HELP = {
  gap: CARD_CONTENT.rowGap,
  icon: ACTION_HELP_LAYOUT.homeIcon,
  lineHeight: ACTION_HELP_LAYOUT.homeIcon + 2 * CARD_CONTENT.rowGap,
} as const;
