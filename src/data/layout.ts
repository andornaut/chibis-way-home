// The in-game interface's layout, in base pixels of the SCREEN view unless stated. src/ui/layout
// derives centres, press areas and measured card sizes from these values. Values marked "art"
// are fixed by the art drawn at that size; change them only with the art.

import { MODAL_CONTENT } from "@andornaut/game-kit/modalLayout";

import type { MapNode, Point, Rect, Size } from "./types";

// Press areas: every drawn button's press area reaches past it on every side by marginShare of
// its shorter side, clamped to leastMargin and mostMargin, then grows to at least minTarget on
// each axis about its centre.
export const HIT_RULE = {
  leastMargin: 6,
  marginShare: 0.25,
  minTarget: 48,
  mostMargin: 16,
} as const;

// The clear circle about Use's and Jump's centres that the move hint never reaches into.
export const TOUCH_CIRCLE_RADIUS = 63;

// On-screen controls

// Art draws each control (pause, Use, Jump and the move hint) this far inside its frame.
export const CONTROL_FRAME_INSET = 1;

// The top-corner HUD's drawn edge in from the view: Pause's disc in from the view's top and left,
// and the skill row's discs in from its top and the rightmost one in from its right, so the two
// corners mirror.
export const HUD_EDGE = 12;

// Use, Jump and the move hint's drawn bottom edge above the view's bottom edge.
export const CONTROL_BOTTOM = 30;

// Jump's drawn right edge in from the view's right, and the move hint's drawn left edge in from
// the view's left.
export const CONTROL_SIDE = 40;

export const TOUCH_LAYOUT = {
  // The move hint's knob moves at most this far left or right of its ring's centre.
  knobReach: 12,
  // Use's centre from Jump's centre.
  useFromJump: { x: -77, y: -100 } satisfies Point,
} as const;

// The skill HUD's buttons, packed along the view's top right, HUD_EDGE in from its top and right.
export const SKILL_HUD = {
  // The gap between adjacent buttons' targets.
  gap: 8,
  // art: the skill glyph's frame side.
  glyph: 16,
  // A button's square press target side, centred on its disc.
  target: 48,
} as const;

// Buttons

// Standard text buttons on the start screen, cards and footers.
export const TEXT_BUTTON = {
  // The gap between buttons side by side.
  gap: 8,
  // The drawn button's height, lip included.
  height: 48,
  // The label's least clearance from the button's left and right edges.
  inset: 16,
  // art: the ui-button lip below the face.
  lipHeight: 4,
  // How far a pressed face sinks.
  pressedSink: 2,
  // The gap between stacked buttons' faces.
  stackGap: 8,
  // The label's least clearance from the face's top and bottom edges.
  verticalInset: 12,
} as const;

// The play mark drawn before a label such as Resume's: its gap to the label's ink, and its size.
export const PLAY_MARK = { gap: 6, height: 10, width: 5 } as const;

// Keyboard focus

// art: the ui-focus 9-slice, drawn this far outside the focused row, button or close X: a yellow
// band between two ink lines inkLine wide.
export const FOCUS_RING = { inkLine: 1, outset: 4 } as const;

// Modal cards

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
  // The progress bar's height, also the loading bar's.
  progressHeight: 2,
} as const;

// The required dialogue choice card's prompt wraps to at most this many lines.
export const DIALOGUE_CHOICE = { promptLines: 3 } as const;

export const SETTINGS_CARD = {
  // art: each row's leading icon side, and the install steps glyph's.
  icon: 16,
  // art: the compact Install face, centred in its full-height row, and its label's least
  // clearance from the face's left and right edges.
  install: { height: 28, inset: 8, width: 72 },
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

// PLACEHOLDER: the celebration card after the last zone, until art draws one.
export const CELEBRATION_LAYOUT = {
  // The card's top-left corner.
  at: { x: 176, y: 88 } satisfies Point,
  // Restart and Continue's drawn size.
  button: { height: 44, width: 160 } satisfies Size,
  // Restart and Continue's top below the first row's top.
  buttonsTop: 72,
  // Continue's left edge.
  continueX: 368,
  // The first row's top below the card's top.
  firstRowTop: 48,
  // The card's height.
  height: 184,
  // The message's top-left: its x, and its top below the first row's top.
  message: { top: 4, x: 198 },
  // Restart's left edge.
  restartX: 192,
  // The message's widest line.
  room: 324,
  // The title slot's top below the card's top.
  titleTop: 8,
  // The card's width.
  width: 368,
} as const;

// Dialogue

export const DIALOGUE_LAYOUT = {
  // The least width of Skip and Continue.
  buttonWidth: 192,
  // The departure footer's buttons' drawn edge in from the view's right and bottom.
  departureInset: 16,
  // Skip and Continue below the panel: their gap below the panel's bottom and their height.
  footer: { gap: 4, height: 36 },
  // The speaker's name tab: its top's clearance below the skill HUD's drawn discs, its drawn edge in
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
  // Back to title and Continue: their width and top.
  action: { width: 192, y: 300 },
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
  // The title's top-left.
  title: { x: 24, y: 16 } satisfies Point,
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
  // PLACEHOLDER: the frame drawn for a room without art, and its line width.
  frame: { height: 288, width: 672, x: 24, y: 48 } satisfies Rect,
  frameLine: 2,
  // Leave's drawn button at the view's top right, and its label's widest ink.
  leave: { height: 28, width: 72, x: 640, y: 10 } satisfies Rect,
  leaveRoom: 56,
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
  // art: an icon button's side, its icon's top-left within it, and its top.
  iconButton: { icon: { x: 8, y: 6 } satisfies Point, size: 36, y: 6 },
  // The distance between adjacent icon buttons' left edges.
  iconSlot: 44,
  // The gap from the logo's bottom to the action row's top.
  logoActionGap: 15,
  // The gap from the nav bar's bottom to the logo's top.
  logoTopGap: 12,
  // The nav bar's height.
  navHeight: 48,
  // How far a pressed icon sinks.
  pressedSink: 2,
  // The last icon button's left edge.
  rightIconX: 676,
  // Start's drawn width, left edge and top.
  start: { width: 192, x: 264, y: 268 },
} as const;
