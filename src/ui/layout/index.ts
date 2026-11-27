// Pure screen and control geometry shared by the game views.
export { achievementsCardProperties, achievementsPerPage } from "./achievementsCard.ts";
export { ACTION_HELP } from "./actionHelp.ts";
export { buttonFace, type ButtonFaceState } from "./buttonLabel.ts";
export {
  contactBorder,
  contactCueOn,
  contactOverscan,
  contactWorldOffset,
} from "./contactFeedback.ts";
export { type CardWidth } from "./contentCard.ts";
export {
  HUD_DISC_SIZES,
  PAUSE_DISC,
  PAUSE_VISIBLE_DIAMETER,
  TOUCH_CHROME_FRAME,
} from "./controlChrome.ts";
export {
  DIALOGUE_PORTRAIT_SIZE,
  DIALOGUE_SCREEN,
  dialogueNameTab,
  dialogueSpeakerLayout,
} from "./dialogueScreen.ts";
export {
  capTop,
  FONT_METRICS,
  FONT_ROLES,
  FONT_SCALE,
  TEXT_ROLE_STYLES,
  UI_FONT_FACE,
} from "./fontRoles.ts";
export { hitMargin, type PressArea, pressedArea } from "./hitAreas.ts";
export { type LabelledButton, labelledButton } from "./labelledButton.ts";
export {
  MAP_PATH_LOOKS,
  MAP_SCREEN,
  mapLabel,
  type PathLook,
  type PathStroke,
} from "./mapScreen.ts";
export { PAGE_TITLE } from "./pageTitle.ts";
export { ENTRY_ORIGIN, ENTRY_WIDTH, PAUSE_BUTTON } from "./pauseCard.ts";
export { canvasSize, playView, shifted, viewShift } from "./playView.ts";
export { ROOM_SCREEN } from "./roomScreen.ts";
export {
  RUN_STAT_KEYS,
  runStatLabels,
  STAGE_METRICS,
  type StatsMetricRow,
  statsTotalRows,
  type StatsTotalsSnapshot,
} from "./runStats.ts";
export { SETTINGS_LAYOUT, SETTINGS_ROWS, SWITCH_ROWS } from "./settingsCard.ts";
export { SKILL_ROOM } from "./skillDetails.ts";
export {
  SKILL_ART,
  SKILL_BUTTON,
  SKILL_HUD_GROUP,
  SKILL_HUD_TOP,
  skillButton,
  skillHud,
  skillHudItems,
  skillHudWidth,
} from "./skillHud.ts";
export { stageProgressRect } from "./stageProgress.ts";
export {
  STAGE_FACE,
  STAGE_ROW_WIDTH,
  STAGE_SELECT_LAYOUT,
  STAGE_SELECT_WIDTH,
  stagePageOf,
  STAGES_PER_PAGE,
} from "./stageSelectCard.ts";
export { type IconButtonLayout, type StartScreenLayout, startScreenLayout } from "./startScreen.ts";
export { type TouchControl, type TouchLayout, touchLayout } from "./touchControls.ts";
