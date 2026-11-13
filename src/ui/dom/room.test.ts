// @vitest-environment happy-dom
import { expect, it } from "vitest";

import { DIALOGUES, SPEAKERS } from "../../data/dialogues.ts";
import { TEXT } from "../../data/text.ts";
import { dialogueParagraphs } from "../dialogue/conversation.ts";
import { ROOM_SCREEN } from "../layout/roomScreen.ts";
import { createRoomView } from "./room.ts";

const COLOURS = {
  cream: 0xead4aa,
  ink: 0x181425,
  navy: 0x262b44,
  white: 0xffffff,
  yellow: 0xfee761,
};
const WORDS = { actions: TEXT.buttons, icons: TEXT.actionIcons };

it("renders an ordinary room's name and sole secondary Leave control at its existing target", () => {
  const view = createRoomView(document, COLOURS, ROOM_SCREEN.leave, {
    ...WORDS,
    action: TEXT.room.leave,
    name: TEXT.rooms.test?.name ?? "",
  });
  expect(view.root.querySelector("h1")?.textContent).toBe(TEXT.rooms.test?.name ?? "");
  expect(view.root.querySelectorAll("button")).toHaveLength(1);
  expect(view.leave.textContent).toBe(TEXT.room.leave);
  expect(view.leave.classList.contains("ui-text-button-primary")).toBe(false);
  expect(view.root.style.getPropertyValue("--room-action-height")).toBe(
    String(ROOM_SCREEN.leave.art.height),
  );
  expect(view.root.style.getPropertyValue("--room-action-hit-height")).toBe(
    String(ROOM_SCREEN.leave.hit.height),
  );
  expect([view.glyph, view.panel]).toEqual([undefined, undefined]);
  expect(view.root.querySelector("canvas")).toBeNull();
});

it("keeps gift text, helper name, animated portrait slot and primary Continue in semantic HTML", () => {
  const skill = TEXT.skills.dash;
  const paragraph = dialogueParagraphs(SPEAKERS, TEXT, DIALOGUES["dash-gift"]!)[0]!;
  const view = createRoomView(document, COLOURS, ROOM_SCREEN.leave, {
    ...WORDS,
    action: TEXT.dialogue.continue,
    gift: { description: skill.description, disc: skill.title, paragraph, title: skill.title },
    name: "",
  });
  expect(view.root.querySelector("h1")?.textContent).toBe(skill.title);
  expect(view.panel?.tab.textContent).toBe(paragraph.name);
  expect(view.panel?.line.textContent).toBe(paragraph.text);
  expect(view.root.querySelectorAll("button")).toHaveLength(1);
  expect(view.leave.textContent).toBe(TEXT.dialogue.continue);
  expect(view.leave.classList.contains("ui-text-button-primary")).toBe(true);
  expect(view.glyph?.alt).toBe("");
  expect(view.panel?.portrait.alt).toBe("");
  expect(view.root.querySelectorAll(".dialogue-portrait")).toHaveLength(1);
  expect(view.root.querySelector(".room-description")?.textContent).not.toContain("{jump}");
});
