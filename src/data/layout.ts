// The in-game interface's layout, in base pixels of the SCREEN view unless stated. src/ui/layout
// derives centres, press areas and measured card sizes from these values. Values marked "art"
// are fixed by the art drawn at that size; change them only with the art.

import { MODAL_CONTENT } from "@andornaut/game-kit/runtime/modalLayout";
import { BUTTON_GAP } from "@andornaut/game-kit/runtime/ui/spacing";

import type { MapNode, Point, Rect, Size } from "./types/index.ts";

// The clear circle about Use's and Jump's centres that the move hint never reaches into.
export const TOUCH_CIRCLE_RADIUS = 63;

// On-screen controls

// Art draws each control (pause, Use, Jump and the move hint) this far inside its frame.
export const CONTROL_FRAME_INSET = 1;

export const CONTROL_DISC_FRAME = 35;

export const MENU_GLYPH = {
  bars: [
    { height: 3, width: 11, x: 12, y: 11 },
    { height: 3, width: 11, x: 12, y: 16 },
    { height: 3, width: 11, x: 12, y: 21 },
  ],
  frame: CONTROL_DISC_FRAME,
} as const;

export const PAUSE_GLYPH = {
  bars: [
    { height: 13, width: 4, x: 12, y: 11 },
    { height: 13, width: 4, x: 19, y: 11 },
  ],
  frame: CONTROL_DISC_FRAME,
} as const;

// The top-corner HUD's drawn edge in from the view's sides: Pause's disc in from the left and the
// skill row's rightmost disc in from the right, so the two corners mirror. Both centre on the top
// section's middle (src/ui/layout/topBar.ts).
export const HUD_EDGE = 12;

// Use, Jump and the move hint are placed from the full game canvas's edges (the navigation
// column's edge on the left where it shows), then each is held CONTROL_VIEW_MARGIN inside the
// view's edge, so none is drawn in or against a bar.

// Jump and the move hint's drawn bottom edge above the canvas's bottom edge.
export const CONTROL_BOTTOM = 40;

// Jump's drawn right edge in from the canvas's right, and the move hint's drawn left edge in from
// the canvas's left.
export const CONTROL_SIDE = 60;

// The least distance from Jump's and the move hint's drawn edges to the view's bottom and outer
// side edges.
export const CONTROL_VIEW_MARGIN = 8;

export const TOUCH_LAYOUT = {
  // The move hint's knob moves at most this far left or right of its ring's centre.
  knobReach: 12,
  // The decorative touch controls' opacity.
  opacity: 0.85,
  // Use's centre from Jump's centre.
  useFromJump: { x: -70, y: -70 } satisfies Point,
} as const;

// The skill HUD's buttons, packed along the view's top right, centred on the top section's middle
// with the rightmost disc HUD_EDGE in from the right.
export const SKILL_HUD = {
  // art: the skill glyph's frame side.
  glyph: 16,
  // A button's square press target side, centred on its disc.
  target: 48,
} as const;

// Buttons

// Standard text buttons on the start screen, cards and footers.
export const TEXT_BUTTON = {
  // The gap between neighbouring buttons' faces side by side.
  gap: BUTTON_GAP,
  // The drawn button's height, lip included.
  height: 48,
  // The label's least clearance from the button's left and right edges.
  inset: 16,
  // art: the ui-button lip below the face.
  lipHeight: 4,
  // How far a pressed face sinks.
  pressedSink: 2,
  // The label's least clearance from the face's top and bottom edges.
  verticalInset: 12,
} as const;

// The play mark drawn before a label such as Resume's: its gap to the label's ink, and its size.
export const PLAY_MARK = { gap: 6, height: 10, width: 5 } as const;

// Modal cards

// Each modal card takes one width family's width, held CARD_SCREEN_MARGIN in from the view's sides
// (src/ui/layout/contentCard.ts cardWidth); its height follows its content up to the view's height
// less CARD_SCREEN_MARGIN above and below (ui.css .ui-card).
export const CARD_WIDTH = { large: 688, medium: 500, small: 400 } as const;
export const CARD_SCREEN_MARGIN = 16;

export const CARD_CONTENT = {
  // The close X's drawn edge in from the card's top and right edges.
  closeInset: 6,
  // The close X's drawn side.
  closeSize: 24,
  // art: ui-settings-card's 9-slice top edge (its ink line and highlight), inside which a title's
  // top gap is measured.
  frameBorder: 2,
  // The gap between content groups.
  gap: 8,
  // The least height of a single text line's slot.
  lineHeight: 16,
  // The card's inner padding on every side.
  padding: MODAL_CONTENT.padding,
  // The gap between stacked rows within a group.
  rowGap: 4,
} as const;

// The Achievements card's entry list.
export const ACHIEVEMENTS_CARD = {
  // Each column's width, icon included.
  columnWidth: 312,
  // The number of entry columns per page.
  columns: 2,
  // Each entry's description wraps to at most this many lines.
  descriptionLines: 2,
  // art: the icon-achievement frame side.
  icon: 16,
} as const;

// Text with inline control icons.
export const ACTION_HELP_LAYOUT = {
  // The home page's HTML control icon side.
  homeIcon: 40,
  // Text with an icon wraps to at most this many lines.
  maxLines: 2,
} as const;

export const DEATH_CARD = {
  // The statistics divider's width.
  dividerWidth: 2,
} as const;

// The page and in-game loading bar share this height; stage progress has its own style.
export const LOADING_LAYOUT = { height: 2 } as const;

export const LOADING_FAILURE_PRESENTATION = {
  action: {
    borderWidth: 1,
    height: TEXT_BUTTON.height,
    highlightHeight: 1,
    paddingBottom: TEXT_BUTTON.lipHeight,
    paddingX: TEXT_BUTTON.inset,
    shadeHeight: TEXT_BUTTON.lipHeight,
  },
  panel: {
    bodyActionGapPx: 24,
    borderWidthPx: 1,
    lipHeightPx: 4,
    // CLEANUP (added 2026-11-15): confirm this provisional width after the approved font comparison.
    maxWidthPx: 328,
    paddingBottomPx: 16,
    paddingTopPx: 24,
    paddingXPx: 16,
    safeInsetPx: 16,
    shadowOffsetPx: 4,
    titleBodyGapPx: 16,
  },
  text: {
    action: { lineHeight: 1.2, sizePx: 18, weight: 700 },
    body: { lineHeight: 1.45, sizePx: 18, weight: 400 },
    title: { lineHeight: 1.2, sizePx: 24, weight: 700 },
  },
} as const;

export const SETTINGS_CARD = {
  // art: each row's leading icon side, and the install steps glyph's.
  icon: 16,
  // Install steps wrap within this width beside their glyph.
  stepsTextWidth: 320,
  // art: the toggle switch's size.
  switch: { height: 16, width: 32 } satisfies Size,
} as const;

// The skill details card's description wraps within at most this width.
export const SKILL_DETAILS = { descriptionWidth: 512 } as const;

export const STAGE_SELECT = {
  // A stage's name wraps to at most this many lines.
  labelLines: 2,
} as const;

// art: a stage preview image's size.
export const STAGE_PREVIEW = { height: 84, width: 168 } satisfies Size;

// Dialogue

export const DIALOGUE_LAYOUT = {
  // The departure footer's buttons' drawn edge in from the view's right and bottom.
  departureInset: 16,
  // The gap between the panel and the action row.
  footer: { gap: 4 },
  // The speaker's name tab: clearance, which with HUD_EDGE and the disc's side puts its top at y 66,
  // 25.5 below the top row's centred discs (src/ui/layout/dialogueScreen.ts); its drawn edge in
  // from the panel's end opposite the portrait, its height, the name's clearance from its left
  // and right edges, and how far it rises above the panel's top.
  nameTab: { clearance: 21, endInset: 8, height: 20, inset: 6, overhang: 10 },
  // The panel's clearance round the portrait frame.
  padding: 4,
  // The panel's size; it is centred across the view.
  panel: { height: 60, width: 480 } satisfies Size,
  // The portrait's drawn side, in the dialogue panel and gift rooms.
  portrait: 48,
  // art: the ui-portrait-frame border width around the portrait.
  portraitInset: 2,
  // The text column: its clearance from the portrait frame and from the panel's far edge, its
  // line count and baseline-to-baseline pitch.
  text: { gap: 8, lines: 2, pitch: 20 },
} as const;

// Full screens

export const MAP_LAYOUT = {
  // The top of the Map action row.
  actionY: 300,
  // art: the bird's top-left from a marker's centre, by node kind.
  bird: {
    fork: { x: -13, y: -36 } satisfies Point,
    zone: { x: -13, y: -39 } satisfies Point,
  },
  // art: a zone icon's top-left from its marker's centre.
  icon: { x: -7, y: -7 } satisfies Point,
  // A zone name's knockout: its height, the text's clearance inside it, its top below the
  // marker's centre and its width.
  label: { height: 16, padding: 2, top: 17, width: 212 },
  // art: a marker frame's top-left from its centre, by node kind.
  marker: {
    fork: { x: -14, y: -14 } satisfies Point,
    zone: { x: -17, y: -17 } satisfies Point,
  },
  // art: the paper map, filling the screen.
  paper: { height: 360, width: 720, x: 0, y: 0 } satisfies Rect,
  // The title's top.
  title: { y: 16 },
  // art: a zone marker frame's side.
  zoneMarker: 35,
} as const;

// How map paths are drawn: each bent by bend times its length, stamped every step px, and stopped
// trim px from the centre of the node at each end, by the node's kind.
export const MAP_PATH = {
  bend: 0.08,
  step: 0.5,
  trim: { fork: 11, zone: 15 } satisfies Record<MapNode["kind"], number>,
} as const;

export const ROOM_LAYOUT = {
  // PLACEHOLDER: the side and bottom inset and stroke width of a room without art.
  frameInset: 24,
  frameLine: 2,
  // Leave's painted right edge is aligned with the navigation at the top of the view.
  leaveRightInset: 8,
  // The room name's centre.
  nameCentre: { x: 360, y: 192 } satisfies Point,
} as const;

// The cutscene's stage summary.
export const STAGE_SUMMARY = {
  // Each statistics column's width.
  columnWidth: 152,
  // The preview image's drawn height.
  previewHeight: 120,
} as const;

export const START_SCREEN = {
  // The top of the Start action row.
  actionY: 268,
  // The Exit button's horizontal centre and established target size.
  exitCentreX: 694,
  exitTarget: 54,
  // The gap from the logo's bottom to the action row's top.
  logoActionGap: 15,
  // The gap from the nav bar's bottom to the logo's top.
  logoTopGap: 12,
  // The nav bar's height.
  navHeight: 48,
} as const;
