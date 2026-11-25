// @vitest-environment happy-dom
import { arrangeActions } from "@andornaut/game-kit/runtime/ui/actionGroup";
import { placeModalFrame } from "@andornaut/game-kit/runtime/ui/modalFrame";
import { expect, it } from "vitest";

import { DIALOGUES, SPEAKERS } from "../../data/dialogues.ts";
import { CARD_CONTENT, CARD_SCREEN_MARGIN, CARD_WIDTH, TEXT_BUTTON } from "../../data/layout.ts";
import { SCREEN } from "../../data/screen.ts";
import { TEXT } from "../../data/text.ts";
import { dialogueParagraphs } from "../dialogue/conversation.ts";
import { hitMargin } from "../layout/hitAreas.ts";
import { ROOM_SCREEN } from "../layout/roomScreen.ts";
import { SKILL_ROOM } from "../layout/skillDetails.ts";
import { createRoomView, ROOM_GIFT_CONTENT } from "./room.ts";

const COLOURS = {
  cream: 0xead4aa,
  ink: 0x181425,
  navy: 0x262b44,
  white: 0xffffff,
  yellow: 0xfee761,
};
const WORDS = { actions: TEXT.buttons, icons: TEXT.actionIcons };
const HIT = hitMargin({ height: TEXT_BUTTON.height, width: TEXT_BUTTON.height, x: 0, y: 0 });

function giftWords() {
  const skill = TEXT.skills.dash;
  const paragraph = dialogueParagraphs(SPEAKERS, TEXT, DIALOGUES["dash-gift"]!)[0]!;
  return {
    paragraph,
    skill,
    words: {
      ...WORDS,
      action: TEXT.dialogue.continue,
      gift: { description: skill.description, disc: skill.title, paragraph, title: skill.title },
      name: "",
    },
  };
}

const named = (root: HTMLElement, attribute: string, element: Element) =>
  root.querySelector(`#${element.getAttribute(attribute)}`)?.textContent;

it("names an ordinary room by its heading, with a sole enabled secondary Leave", () => {
  const name = TEXT.rooms.test!.name;
  const view = createRoomView(document, COLOURS, { ...WORDS, action: TEXT.room.leave, name });
  const buttons = [...view.root.querySelectorAll("button")];
  expect({
    buttons: buttons.map(({ textContent }) => textContent),
    disabled: view.leave.disabled,
    heading: view.root.querySelector("h1")?.textContent,
    name: named(view.root, "aria-labelledby", view.root),
    primary: view.leave.classList.contains("ui-text-button-primary"),
    role: view.root.getAttribute("role"),
    sole: buttons[0] === view.leave,
  }).toEqual({
    buttons: [TEXT.room.leave],
    disabled: false,
    heading: name,
    name,
    primary: false,
    role: "region",
    sole: true,
  });
  expect([view.glyph, view.panel]).toEqual([undefined, undefined]);
});

it("names a gift room by its skill, described by the skill's text, with a sole primary action", () => {
  const { paragraph, skill, words } = giftWords();
  const view = createRoomView(document, COLOURS, words);
  const card = view.root.querySelector<HTMLElement>("[aria-describedby]")!;
  const buttons = [...view.root.querySelectorAll("button")];
  expect({
    buttons: buttons.map(({ textContent }) => textContent),
    card: named(view.root, "aria-labelledby", card),
    helper: [view.panel?.tab.textContent, view.panel?.line.textContent],
    images: [view.glyph?.alt, view.panel?.portrait.alt],
    name: named(view.root, "aria-labelledby", view.root),
    primary: view.leave.classList.contains("ui-text-button-primary"),
    roles: [view.root.getAttribute("role"), card.getAttribute("role")],
  }).toEqual({
    buttons: [TEXT.dialogue.continue],
    card: skill.title,
    helper: [paragraph.name, paragraph.text],
    images: ["", ""],
    name: skill.title,
    primary: true,
    roles: ["region", "region"],
  });
  // The description shows its control placeholders as illustrations.
  const description = named(view.root, "aria-describedby", card);
  expect(description).toBeTruthy();
  expect(description).not.toMatch(/\{\w+\}/u);
  // The card is part of the room: nothing takes the presses outside it.
  expect(view.root.querySelector<HTMLElement>(".ui-backdrop")?.hidden).toBe(true);
});

it("keeps authoring gift glyphs and dialogue portraits independent of a live room", () => {
  const { words } = giftWords();
  const live = createRoomView(document, COLOURS, words);
  document.body.append(live.root);
  live.glyph!.src = "blob:runtime-glyph";
  const authored = createRoomView(document, COLOURS, words);
  expect(authored.glyph!.getAttribute("src")).toBeNull();
  expect(authored.panel!.portrait).not.toBe(live.panel!.portrait);
  live.root.remove();
});

// Leave's group is as wide as its face, so its face's right edge is the group's.
it("puts Leave's face at y 2 ending at x 712, its press area ending at the view's edges", () => {
  const size = { height: TEXT_BUTTON.height, width: 81 };
  const [leave] = arrangeActions({ axis: "row", width: size.width }, [
    { key: "leave", role: "secondary", size },
  ]).actions;
  expect(leave).toMatchObject({
    face: { ...size, x: 0, y: 0 },
    outset: { bottom: HIT, left: HIT, right: HIT, top: HIT },
  });
  const { rightInset, y } = ROOM_SCREEN.leave;
  expect([y, SCREEN.width - rightInset]).toEqual([2, 712]);
  // The view clips the press area where the margin reaches past it.
  expect([Math.min(HIT, y), Math.min(HIT, rightInset)]).toEqual([2, 8]);
});

it("centres the gift action in the footer, 16 in from the view's bottom", () => {
  const size = { height: TEXT_BUTTON.height, width: 106 };
  const { footer } = SKILL_ROOM;
  expect(footer).toEqual({
    height: TEXT_BUTTON.height,
    width: SCREEN.width - 2 * CARD_CONTENT.padding,
    x: CARD_CONTENT.padding,
    y: 296,
  });
  const [action] = arrangeActions({ width: footer.width }, [
    { key: "continue", role: "primary", size },
  ]).actions;
  expect(action).toMatchObject({ face: { ...size, x: 291, y: 0 } });
  expect(footer.x + 291 + size.width / 2).toBe(SCREEN.width / 2);
});

it.each([81, 100, 132])(
  "centres a gift card %i tall between the panel and the footer's press area",
  (height) => {
    const padding = CARD_CONTENT.padding;
    const title = 17;
    const { card } = placeModalFrame(
      {
        content: ROOM_GIFT_CONTENT,
        families: CARD_WIDTH,
        family: "large",
        gap: CARD_CONTENT.gap,
        margin: CARD_SCREEN_MARGIN,
        padding,
      },
      { body: height - title - 3 * padding, title: { height: title } },
    );
    const { bounds } = SKILL_ROOM;
    expect(card).toEqual({
      height,
      width: CARD_WIDTH.large,
      x: (SCREEN.width - CARD_WIDTH.large) / 2,
      y: bounds.y + Math.floor((bounds.height - height) / 2),
    });
    expect(card.y + card.height).toBeLessThanOrEqual(bounds.y + bounds.height);
  },
);
