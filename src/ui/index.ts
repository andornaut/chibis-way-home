// The interface: layout of screens and cards, dialogue, input intent, keyboard focus, pause and
// room input, touch settings, control chrome and the map's drawing. src/ui/input/frameTurn.ts
// watches the page on load, so it stays out of this index.
export { actionHelpParts } from "./chrome/actionHelp.ts";
export { type Palette } from "./chrome/dim.ts";
export { helpChromeLayers, helpChromeSvg } from "./chrome/helpChrome.ts";
export { modalColour } from "./chrome/modalDim.ts";
export { moveHintView } from "./chrome/moveHint.ts";
export {
  PAUSE_CHROME_FRAME,
  pauseChromeLayers,
  type PauseChromePose,
} from "./chrome/pauseChrome.ts";
export { skillChromeLayers } from "./chrome/skillChrome.ts";
export {
  TOUCH_CHROME_FRAME,
  TOUCH_KNOB_FRAME,
  type TouchChromeKind,
  type TouchChromeLayer,
  touchChromeLayers,
  touchChromePixel,
  type TouchChromePose,
} from "./chrome/touchChrome.ts";
export { buttonHeld, centredAt, controlTag, trackPress } from "./chrome/touchControls.ts";
export { UI_FONT_RESOURCES } from "./chrome/uiFonts.ts";
export {
  type DialogueAction,
  dialogueChoice,
  dialogueChoiceKey,
  type DialogueControl,
  dialogueKeyAction,
  type DialogueParagraph,
  dialogueParagraphs,
  type DialoguePress,
  dialogueProgress,
  dialogueTapAction,
  moveDialoguePress,
  type ResolvedDialogueChoice,
} from "./dialogue/conversation.ts";
export { statsStatement } from "./dialogue/statsStatement.ts";
export {
  type AchievementsCardView,
  createAchievementsCard,
  showAchievementsPage,
} from "./dom/achievements.ts";
export { type CardView, createCard, createMessageCard, showPresses } from "./dom/card.ts";
export {
  type CelebrationControl,
  type CelebrationView,
  type CelebrationWords,
  createCelebrationView,
} from "./dom/celebration.ts";
export { type ChoiceCardView, createChoiceCard } from "./dom/choice.ts";
export { createDeathCard, type DeathCardView } from "./dom/death.ts";
export {
  createDialoguePanel,
  createDialogueView,
  createStatusPanel,
  DIALOGUE_FOOTER_LAYOUT,
  DIALOGUE_PANEL_LAYOUT,
  type DialoguePanelView,
  type DialogueView,
  onPanel,
  type PanelParagraph,
  showPanelParagraph,
  type StatusPanelView,
} from "./dom/dialogue.ts";
export { createUiLayer, loadUiFonts, UI_DIMMED, UI_LAYOUT, type UiLayer } from "./dom/layer.ts";
export {
  createMap,
  type DestinationLook,
  type MapFace,
  type MapView,
  type MapWords,
} from "./dom/map.ts";
export {
  createOpeningView,
  type OpeningAction,
  type OpeningView,
  showOpeningCaption,
} from "./dom/opening.ts";
export {
  createPauseView,
  PAUSE_LAYOUT,
  type PauseColours,
  type PauseDiscPose,
  type PauseView,
  showPauseDisc,
  showSkillButton,
  skillPlace,
} from "./dom/pause.ts";
export { refuseControl } from "./dom/refusal.ts";
export {
  createRoomView,
  roomPortraitProperties,
  type RoomView,
  type RoomViewColours,
  type RoomViewWords,
} from "./dom/room.ts";
export {
  createSettingsCard,
  type SettingsCardView,
  type SettingsSpriteRow,
  type SettingsSwitch,
  showSteps,
  showSwitches,
} from "./dom/settings.ts";
export { createSkillDetailsCard, type SkillDetailsView } from "./dom/skillDetails.ts";
export { filledFrame } from "./dom/skillDisc.ts";
export { applySkin, remappedFrame, type SkinFrame, UI_FRAMES } from "./dom/skin.ts";
export { createStageProgress, type StageProgressView } from "./dom/stageProgress.ts";
export { createStageSelect, type StageFace, type StageSelectView } from "./dom/stageSelect.ts";
export {
  createStageSummary,
  STAGE_SUMMARY_LAYOUT,
  type StageSummaryView,
  type StageSummaryWords,
} from "./dom/stageSummary.ts";
export { createStart, type StartControl, type StartView, type StartWords } from "./dom/start.ts";
export {
  createTouchControls,
  type TouchControlsState,
  type TouchControlsView,
  type TouchControlVisual,
} from "./dom/touchControls.ts";
export { focusKeyAction, stepFocus } from "./focus/index.ts";
export { DEATH_ACTIONS, type DeathAction, deathKeyAction } from "./input/deathInput.ts";
export {
  combineIntents,
  type HeldTouch,
  keyIntent,
  touchIntent,
  touchRoleAt,
} from "./input/intent.ts";
export { MAP_ACTIONS, type MapAction, mapKeyAction } from "./input/mapInput.ts";
export { isMouseMovementKey, listenMouseMovement } from "./input/mouseMovement.ts";
export { stagePickerKey } from "./input/stageSelectInput.ts";
export {
  achievementsCardProperties,
  achievementsListTop,
  achievementsPerPage,
} from "./layout/achievementsCard.ts";
export { ACTION_HELP } from "./layout/actionHelp.ts";
export { buttonFace, type ButtonFaceState } from "./layout/buttonLabel.ts";
export { CARD_TEXT_SCALE, cardTitleAt } from "./layout/cardFrame.ts";
export {
  contactBorder,
  contactCueOn,
  contactOverscan,
  contactWorldOffset,
} from "./layout/contactFeedback.ts";
export { PAUSE_VISIBLE_DIAMETER } from "./layout/controlChrome.ts";
export { CUTSCENE_CONTINUE } from "./layout/cutscene.ts";
export {
  DIALOGUE_PORTRAIT_SIZE,
  DIALOGUE_SCREEN,
  dialogueNameTab,
  dialogueSpeakerLayout,
} from "./layout/dialogueScreen.ts";
export { FONT_ROLES, FONT_SCALE } from "./layout/fontRoles.ts";
export { type PressArea, pressedArea } from "./layout/hitAreas.ts";
export { labelledButton } from "./layout/labelledButton.ts";
export { MAP_PATH_LOOKS, MAP_SCREEN, mapLabel, type PathLook } from "./layout/mapScreen.ts";
export { PAUSE_BUTTON } from "./layout/pauseCard.ts";
export { canvasSize, playView, shifted, viewShift } from "./layout/playView.ts";
export { CELEBRATION, type LabelledButton } from "./layout/restartCard.ts";
export { ROOM_SCREEN } from "./layout/roomScreen.ts";
export {
  RUN_STAT_KEYS,
  runStatLabels,
  STAGE_METRICS,
  statsTotalRows,
  type StatsTotalsSnapshot,
} from "./layout/runStats.ts";
export { focusRingAround, SETTINGS_LAYOUT } from "./layout/settingsCard.ts";
export { SKILL_ROOM } from "./layout/skillDetails.ts";
export { SKILL_ART, SKILL_BUTTON, skillButton, skillHud } from "./layout/skillHud.ts";
export { stageProgressRect } from "./layout/stageProgress.ts";
export { stagePageOf, STAGES_PER_PAGE } from "./layout/stageSelectCard.ts";
export {
  type IconButtonLayout,
  type StartScreenLayout,
  startScreenLayout,
} from "./layout/startScreen.ts";
export { type TouchControl, type TouchLayout, touchLayout } from "./layout/touchControls.ts";
export {
  destinationAtTap,
  destinationCentre,
  destinationPathLook,
  destinationState,
} from "./map/mapDestinations.ts";
export { bentCurve, curveWalk, pathRects } from "./map/mapPath.ts";
export {
  type CardAction,
  cardBackAction,
  cardKeyAction,
  cardTurnAction,
  pauseKey,
  startBackAction,
} from "./pause/cardInput.ts";
export { type RoomEvent, roomEvent } from "./pause/roomInput.ts";
export { reducedMotion, setReducedMotion } from "./settings/reducedMotion.ts";
export {
  coarsePointer,
  setTouchSettingShown,
  TOUCH_SETTINGS,
  type TouchSetting,
  touchSettings,
  touchSettingShown,
} from "./settings/touchControls.ts";
