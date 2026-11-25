import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { ACTION_GAPS, arrangeActions } from "@andornaut/game-kit/runtime/ui/actionGroup";
import { type FormRowLayout, formRowPresentation } from "@andornaut/game-kit/runtime/ui/formRow";
import { HIT_RULE } from "@andornaut/game-kit/runtime/ui/hitAreas";
import { modalFrameRooms, placeModalFrame } from "@andornaut/game-kit/runtime/ui/modalFrame";
import { Blob, Buffer, Face, Font, shape } from "harfbuzzjs";
import { beforeAll, expect, it } from "vitest";

import { DEV_TEXT } from "../../data/dev.ts";
import { CARD_CONTENT, CARD_SCREEN_MARGIN, CARD_WIDTH, TEXT_BUTTON } from "../../data/layout.ts";
import { SCREEN } from "../../data/screen.ts";
import { TEXT } from "../../data/text.ts";
import { FONT_METRICS, UI_FONT_FACE } from "./fontRoles.ts";
import { SETTINGS_ROWS, SWITCH_ROWS } from "./settingsCard.ts";

const WORDS = TEXT.settings;
const BODY = FONT_METRICS.body;

// The card frame's geometry for a titled card with a close X (src/ui/dom/cardFrame.ts).
const frame = (family: keyof typeof CARD_WIDTH) =>
  ({
    close: {
      face: {
        height: CARD_CONTENT.closeSize,
        width: CARD_CONTENT.closeSize,
        x: CARD_CONTENT.closeInset,
        y: CARD_CONTENT.closeInset,
      },
    },
    content: { height: SCREEN.height, width: SCREEN.width, x: 0, y: 0 },
    families: CARD_WIDTH,
    family,
    gap: CARD_CONTENT.gap,
    margin: CARD_SCREEN_MARGIN,
    padding: CARD_CONTENT.padding,
  }) as const;
// A text box trimmed to its cap height and baseline, in whole base px.
const trimmed = (size: number) => size * UI_FONT_FACE.capHeight;
const parts = (body: number) => ({
  body: Math.ceil(body - 1e-6),
  bodyOutset: 0,
  footer: TEXT_BUTTON.height,
  title: {
    height: Math.ceil(trimmed(FONT_METRICS.mainHeading.size)),
    inkOffset: CARD_CONTENT.frameBorder / 2 + 1,
    inset: CARD_CONTENT.padding - CARD_CONTENT.frameBorder / 2,
  },
});
// The tallest card that shows without scrolling.
const LIMIT = SCREEN.height - 2 * CARD_SCREEN_MARGIN;

// The served Regular face, which sets the rows' labels, notes and state words.
let regular: Font;
let unitsPerEm: number;
beforeAll(async () => {
  const decompress = createRequire(import.meta.url)("wawoff2/decompress.js") as (
    font: Uint8Array,
  ) => Promise<Uint8Array>;
  const font = await decompress(
    new Uint8Array(readFileSync("public/art/fonts/chibi-sans/ChibiSans-Regular.woff2")),
  );
  const face = new Face(new Blob(new Uint8Array(font)));
  unitsPerEm = face.upem;
  regular = new Font(face);
});

// A line's advance in base px at the body size.
function advance(text: string): number {
  const buffer = new Buffer();
  buffer.addText(text);
  buffer.guessSegmentProperties();
  shape(regular, buffer);
  const units = buffer.getGlyphPositions().reduce((sum, glyph) => sum + glyph.xAdvance, 0);
  return (units * BODY.size) / unitsPerEm;
}

// The lines text wraps to within width, breaking at spaces.
function lines(text: string, width: number): number {
  let count = 1;
  let line = "";
  for (const word of text.split(" ")) {
    const next = line === "" ? word : `${line} ${word}`;
    if (line !== "" && advance(next) > width) {
      count += 1;
      line = word;
    } else {
      line = next;
    }
  }
  return count;
}

// A switch row's height: its label over its note, at least the row's least height.
function rowHeight(
  layout: FormRowLayout,
  width: number,
  states: readonly string[],
  label: string,
  note?: string,
): number {
  const value = Math.max(layout.switch!.width, ...states.map(advance));
  const icon = layout.icon === undefined ? 0 : layout.icon.slot + layout.columnGap;
  const text = width - icon - layout.columnGap - value;
  const count = lines(label, text) + (note === undefined ? 0 : lines(note, text));
  return Math.max(layout.height, count * BODY.lineHeight);
}

const stacked = (heights: readonly number[]) =>
  heights.reduce((sum, height) => sum + height, 0) +
  (heights.length - 1) * ACTION_GAPS.standard.stack;

it("spaces switch rows by the stacked gap, centres each row and sizes its value column in CSS", () => {
  const { attributes, properties } = formRowPresentation(SETTINGS_ROWS);
  expect(properties["--ui-form-rows-gap"]).toBe(ACTION_GAPS.standard.stack);
  expect(properties["--ui-form-row-height"]).toBe(HIT_RULE.minTarget);
  expect(properties["--ui-form-value-track"]).toBeUndefined();
  expect([attributes["data-ui-form-align"], attributes["data-ui-form-state"]]).toEqual([
    "center",
    "center",
  ]);
  expect(formRowPresentation(SWITCH_ROWS).attributes["data-ui-form-icons"]).toBe("none");
});

it("fits the Settings card with Install in the view without scrolling", () => {
  const context = frame("large");
  const column = (modalFrameRooms(context).body - ACTION_GAPS.standard.row) / 2;
  const touch = [WORDS.state.shown, WORDS.state.hidden];
  const display = [WORDS.state.on, WORDS.state.off];
  const left = stacked([
    rowHeight(SETTINGS_ROWS, column, touch, WORDS.moveControls, WORDS.descriptions.moveControls),
    rowHeight(SETTINGS_ROWS, column, touch, WORDS.actionButtons, WORDS.descriptions.actionButtons),
  ]);
  const right = stacked([
    rowHeight(SETTINGS_ROWS, column, display, WORDS.fps),
    rowHeight(
      SETTINGS_ROWS,
      column,
      display,
      WORDS.reducedMotion,
      WORDS.descriptions.reducedMotion,
    ),
    TEXT_BUTTON.height,
  ]);
  const body = Math.max(left, right) + CARD_CONTENT.gap + trimmed(BODY.size);
  const placed = placeModalFrame(context, parts(body));
  expect(placed.scrolls).toBe(false);
  expect(placed.card.height).toBeLessThanOrEqual(LIMIT);
  expect(placed.card.height).toBe(326);
});

it("stacks the Cheats unlocks at the stacked gap over a row, with Back centred in the footer", () => {
  const context = frame("medium");
  const width = modalFrameRooms(context).body;
  const face = { height: TEXT_BUTTON.height, width: 200 };
  const stack = arrangeActions({ axis: "stack", stackWidth: "fill", width }, [
    { key: "unlockAllPowerUps", role: "secondary", size: face },
    { key: "unlockAllZones", role: "secondary", size: face },
  ]);
  const faces = stack.actions.flatMap((action) => (action.hidden ? [] : [action.face]));
  expect(faces.map(({ width: across, y }) => [across, y])).toEqual([
    [width, 0],
    [width, TEXT_BUTTON.height + ACTION_GAPS.standard.stack],
  ]);
  const footer = arrangeActions({ variant: "footer", width }, [
    { key: "back", role: "primary", size: face },
  ]);
  const back = footer.actions[0]!;
  expect(back.hidden ? undefined : back.face.x).toBe((width - face.width) / 2);
  const row = rowHeight(
    SWITCH_ROWS,
    width,
    [WORDS.state.on, WORDS.state.off],
    DEV_TEXT.invulnerable,
    DEV_TEXT.invulnerableNote,
  );
  const body = stack.group.height + CARD_CONTENT.gap + row;
  const placed = placeModalFrame(context, parts(body));
  expect(placed.scrolls).toBe(false);
  expect(placed.card.height).toBeLessThanOrEqual(LIMIT);
});
