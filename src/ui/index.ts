// The interface: layout of screens and cards, dialogue, input intent, keyboard focus, pause and
// room input, touch settings, control chrome and the map's drawing. src/ui/input/frameTurn.ts
// watches the page on load, so it stays out of this index.
export { actionHelpParts } from "./chrome/actionHelp";
export { type Palette } from "./chrome/dim";
export { helpChromeLayers, helpChromeSvg } from "./chrome/helpChrome";
export { modalColour } from "./chrome/modalDim";
export { moveHintView } from "./chrome/moveHint";
export { PAUSE_CHROME_FRAME, pauseChromeLayers, type PauseChromePose } from "./chrome/pauseChrome";
export { skillChromeLayers } from "./chrome/skillChrome";
export {
  chromeTexels,
  TOUCH_CHROME_FRAME,
  TOUCH_KNOB_FRAME,
  type TouchChromeKind,
  type TouchChromeLayer,
  touchChromeLayers,
  touchChromePixel,
  type TouchChromePose,
} from "./chrome/touchChrome";
export { buttonHeld, centredAt, controlTag, trackPress } from "./chrome/touchControls";
export { mountUiFonts, UI_FONT_RESOURCES } from "./chrome/uiFonts";
export {
  type DialogueAction,
  dialogueChoice,
  dialogueChoiceKey,
  type DialogueControl,
  dialogueKeyAction,
  dialogueLines,
  type DialogueParagraph,
  dialogueParagraphs,
  type DialoguePress,
  dialogueProgress,
  dialogueTapAction,
  moveDialoguePress,
  type ResolvedDialogueChoice,
} from "./dialogue/conversation";
export { statsStatement } from "./dialogue/statsStatement";
export { focusKeyAction, stepFocus } from "./focus";
export { DEATH_ACTIONS, type DeathAction, deathKeyAction } from "./input/deathInput";
export {
  combineIntents,
  type HeldTouch,
  keyIntent,
  touchIntent,
  touchRoleAt,
} from "./input/intent";
export { MAP_ACTIONS, type MapAction, mapKeyAction } from "./input/mapInput";
export { isMouseMovementKey, listenMouseMovement } from "./input/mouseMovement";
export { stagePickerKey } from "./input/stageSelectInput";
export {
  type AchievementEntryLayout,
  achievementsCardLayout,
  achievementsPerPage,
  type AchievementWords,
} from "./layout/achievementsCard";
export { ACTION_HELP, type ActionHelpLayout, actionHelpLayout } from "./layout/actionHelp";
export {
  buttonFace,
  type ButtonFaceState,
  type ButtonLabelPlacement,
  buttonLabelPlacement,
} from "./layout/buttonLabel";
export { CARD_TEXT_SCALE, cardTitleAt } from "./layout/cardFrame";
export {
  contactBorder,
  contactCueOn,
  contactOverscan,
  contactWorldOffset,
} from "./layout/contactFeedback";
export {
  CARD_HEADING,
  cardActions,
  cardActionsSize,
  type CardFonts,
  cardTextOrigin,
  cardTextSize,
  type CardTitleLayout,
  cardTitleOrigin,
  contentCardLayout,
} from "./layout/contentCard";
export { PAUSE_VISIBLE_DIAMETER } from "./layout/controlChrome";
export { CUTSCENE_CONTINUE, STAGE_SUMMARY_BOUNDS } from "./layout/cutscene";
export { deathCard } from "./layout/deathCard";
export { dialogueChoiceLayout } from "./layout/dialogueChoice";
export {
  departureDialogueButtons,
  DIALOGUE_PORTRAIT_SIZE,
  DIALOGUE_SCREEN,
  dialogueBodyLines,
  dialogueButtons,
  dialogueNameTab,
  dialoguePressAreas,
  dialogueSpeakerLayout,
  dialogueTextRows,
} from "./layout/dialogueScreen";
export { FONT_ROLES, FONT_SCALE } from "./layout/fontRoles";
export { type PressArea, pressedArea } from "./layout/hitAreas";
export { labelledButton } from "./layout/labelledButton";
export { MAP_PATH_LOOKS, MAP_SCREEN, mapLabel, type PathLook } from "./layout/mapScreen";
export { openingLayout } from "./layout/opening";
export { PAUSE_BUTTON, pauseCard } from "./layout/pauseCard";
export { playView, shifted, viewShift } from "./layout/playView";
export { CELEBRATION, type LabelledButton, restartCard } from "./layout/restartCard";
export { ROOM_SCREEN } from "./layout/roomScreen";
export {
  RUN_STAT_KEYS,
  runStatLabels,
  stageSummaryLayout,
  statsTotalRows,
  type StatsTotalsSnapshot,
  summaryTextOrigin,
} from "./layout/runStats";
export { focusRingAround, settingsCard, stepsCard } from "./layout/settingsCard";
export { SKILL_ROOM, skillDetails, skillRoomContinue } from "./layout/skillDetails";
export { SKILL_ART, SKILL_BUTTON, skillButton, skillHud } from "./layout/skillHud";
export { stageProgressRect } from "./layout/stageProgress";
export {
  STAGE_NUMBER_SCALE,
  stagePageOf,
  STAGES_PER_PAGE,
  stageSelectPages,
} from "./layout/stageSelectCard";
export {
  type IconButtonLayout,
  type StartScreenLayout,
  startScreenLayout,
} from "./layout/startScreen";
export { textInkBounds } from "./layout/textInk";
export { MOVE_HINT, TOUCH_CONTROLS, type TouchControl } from "./layout/touchControls";
export {
  destinationAtTap,
  destinationCentre,
  destinationPathLook,
  destinationState,
} from "./map/mapDestinations";
export { bentCurve, curveWalk, pathRects } from "./map/mapPath";
export {
  type CardAction,
  cardBackAction,
  cardKeyAction,
  cardTurnAction,
  pauseKey,
  startBackAction,
} from "./pause/cardInput";
export { type RoomEvent, roomEvent } from "./pause/roomInput";
export {
  coarsePointer,
  setTouchSettingShown,
  TOUCH_SETTINGS,
  type TouchSetting,
  touchSettings,
  touchSettingShown,
} from "./settings/touchControls";
