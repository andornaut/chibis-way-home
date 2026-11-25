import { arrangeActions } from "@andornaut/game-kit/runtime/ui/actionGroup";
import { placeModalFrame } from "@andornaut/game-kit/runtime/ui/modalFrame";
import { arrangePager } from "@andornaut/game-kit/runtime/ui/pager";
import { expect, it } from "vitest";

import { CARD_CONTENT, CARD_SCREEN_MARGIN, CARD_WIDTH, TEXT_BUTTON } from "../../data/layout.ts";
import { SCREEN } from "../../data/screen.ts";
import { FONT_METRICS } from "./fontRoles.ts";
import { hitMargin } from "./hitAreas.ts";
import {
  STAGE_FACE,
  STAGE_PAGER_INSET,
  STAGE_ROW_INSET,
  STAGE_ROW_WIDTH,
  STAGE_SELECT_WIDTH,
  stagePageOf,
  STAGES_PER_PAGE,
} from "./stageSelectCard.ts";

// The pager's parts as the page measures them: two text buttons and a body line of count.
const PAGER = {
  count: { height: FONT_METRICS.body.lineHeight, width: 86 },
  next: { height: TEXT_BUTTON.height, width: 68 },
  previous: { height: TEXT_BUTTON.height, width: 102 },
};

function placed<K>(action: ReturnType<typeof arrangeActions<K>>["actions"][number] | undefined) {
  if (action === undefined || action.hidden) {
    throw new Error("The action is placed");
  }
  return action;
}

const faces = arrangeActions(
  { axis: "row", width: STAGE_ROW_WIDTH },
  Array.from({ length: STAGES_PER_PAGE }, (_, key) => ({
    key,
    role: "secondary" as const,
    size: STAGE_FACE,
  })),
).actions.map(placed);
const pager = arrangePager({ width: STAGE_ROW_WIDTH }, PAGER);

// The paged card's frame, as the card frame places a closeable, titled card.
const { closeInset, closeSize, frameBorder, gap, padding } = CARD_CONTENT;
const frame = placeModalFrame(
  {
    close: { face: { height: closeSize, width: closeSize, x: closeInset, y: closeInset } },
    content: { height: SCREEN.height, width: SCREEN.width, x: 0, y: 0 },
    families: CARD_WIDTH,
    family: STAGE_SELECT_WIDTH,
    gap,
    margin: CARD_SCREEN_MARGIN,
    padding,
  },
  {
    body: STAGE_ROW_INSET + STAGE_FACE.height + gap + STAGE_PAGER_INSET + pager.group.height,
    bodyOutset: hitMargin({
      height: TEXT_BUTTON.height,
      width: TEXT_BUTTON.height,
      x: 0,
      y: 0,
    }),
    title: { height: FONT_METRICS.mainHeading.lineHeight, inset: padding - frameBorder / 2 },
  },
);

it("fills a page's row with fixed-size faces the button gap apart, in catalogue order", () => {
  expect({
    gaps: faces
      .slice(1)
      .map((face, index) => face.face.x - (faces[index]!.face.x + STAGE_FACE.width)),
    order: faces.map(({ key }) => key),
    sizes: faces.map(({ face }) => ({ height: face.height, width: face.width })),
    span: faces.at(-1)!.face.x + STAGE_FACE.width - faces[0]!.face.x,
  }).toEqual({
    gaps: faces.slice(1).map(() => TEXT_BUTTON.gap),
    order: faces.map((_, index) => index),
    sizes: faces.map(() => STAGE_FACE),
    span: STAGE_ROW_WIDTH,
  });
});

it("meets neighbouring faces' press areas midway across the gap", () => {
  expect(
    faces.slice(1).map((face, index) => [faces[index]!.outset.right, face.outset.left]),
  ).toEqual(faces.slice(1).map(() => [TEXT_BUTTON.gap / 2, TEXT_BUTTON.gap / 2]));
});

it("keeps the page count the card gap from Previous's and Next's faces", () => {
  expect({
    afterCount: pager.next.face.x - (pager.count.x + pager.count.width),
    beforeCount: pager.count.x - (pager.previous.face.x + pager.previous.face.width),
  }).toEqual({ afterCount: gap, beforeCount: gap });
});

it("fits the paged card in the view less the screen margin, without scrolling", () => {
  expect({
    fits: frame.card.height <= SCREEN.height - 2 * CARD_SCREEN_MARGIN,
    scrolls: frame.scrolls,
  }).toEqual({ fits: true, scrolls: false });
});

it("keeps the card gap between the close X's, the faces' and the pager's press areas", () => {
  const face = faces.at(-1)!;
  const faceTop = frame.body.y + STAGE_ROW_INSET;
  const faceBottom = faceTop + STAGE_FACE.height;
  const pagerTop = faceBottom + gap + STAGE_PAGER_INSET;
  const close = frame.close!.press;
  expect({
    belowClose: faceTop - face.outset.top - (close.y + close.height),
    belowFaces: pagerTop - pager.next.outset.top - (faceBottom + face.outset.bottom),
  }).toEqual({ belowClose: gap, belowFaces: gap });
});

it("finds each stage's page", () => {
  const stages = Array.from({ length: 2 * STAGES_PER_PAGE }, (_, index) => `stage-${index}`);
  expect(stages.map((stage) => stagePageOf(stages, stage))).toEqual(
    stages.map((_, index) => (index < STAGES_PER_PAGE ? 0 : 1)),
  );
});
