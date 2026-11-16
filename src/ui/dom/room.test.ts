// @vitest-environment happy-dom
import { readFileSync } from "node:fs";

import { expect, it } from "vitest";

import { DIALOGUES, SPEAKERS } from "../../data/dialogues.ts";
import { TEXT } from "../../data/text.ts";
import { dialogueParagraphs } from "../dialogue/conversation.ts";
import { PAGE_TITLE } from "../layout/pageTitle.ts";
import { ROOM_SCREEN } from "../layout/roomScreen.ts";
import { createRoomView, roomProperties } from "./room.ts";

const COLOURS = {
  cream: 0xead4aa,
  ink: 0x181425,
  navy: 0x262b44,
  white: 0xffffff,
  yellow: 0xfee761,
};
const WORDS = { actions: TEXT.buttons, icons: TEXT.actionIcons };

it("renders an ordinary room's name and sole secondary Leave control at its existing target", () => {
  const view = createRoomView(document, COLOURS, {
    ...WORDS,
    action: TEXT.room.leave,
    name: TEXT.rooms.test?.name ?? "",
  });
  expect(view.root.querySelector("h1")?.textContent).toBe(TEXT.rooms.test?.name ?? "");
  expect(
    view.leave.querySelector(".ui-text-button-face")!.hasAttribute("data-ui-authored-size"),
  ).toBe(true);
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
  const view = createRoomView(document, COLOURS, {
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
  expect(view.root.hasAttribute("data-gift")).toBe(true);
  expect(view.leave.style.width).toBe("");
  expect(view.leave.querySelector<HTMLElement>(".ui-text-button-face")!.style.width).toBe("");
  expect(view.glyph?.alt).toBe("");
  expect(view.panel?.portrait.alt).toBe("");
  expect(view.root.querySelectorAll(".dialogue-portrait")).toHaveLength(1);
  expect(view.root.querySelector(".room-description")?.textContent).not.toContain("{jump}");
});

it("centres the portrait in its slot while anchoring the page title at its top inset", () => {
  const roomCss = readFileSync("src/ui/dom/room.css", "utf8");
  expect(roomCss).toMatch(/\.room-scene \.dialogue-portrait\s*\{[^}]*translate:\s*-50% -50%;/);
  expect(roomCss).toMatch(/\.room-name\s*\{[^}]*translate:\s*-50% 0;/);
  expect(roomProperties()["--room-name-y"]).toBe(PAGE_TITLE.y);
});

it("centres the sole gift action while retaining its bottom inset and intrinsic width", () => {
  const roomCss = readFileSync("src/ui/dom/room.css", "utf8");
  const action = /\.room-scene\[data-gift\] \.room-leave\s*\{([^}]*)\}/.exec(roomCss)![1]!;
  expect(action).toContain("left: 50%;");
  expect(action).toContain("translate: -50% 0;");
  expect(action).toContain("width: max-content;");
  expect(action).toContain(
    "bottom: calc(var(--ui-unit) * var(--card-padding) * 1px - var(--hit));",
  );
  expect(action).not.toContain("right:");
});

it("keeps authoring gift glyphs and dialogue portraits independent of a live room", () => {
  const skill = TEXT.skills.dash;
  const paragraph = dialogueParagraphs(SPEAKERS, TEXT, DIALOGUES["dash-gift"]!)[0]!;
  const words = {
    ...WORDS,
    action: TEXT.dialogue.continue,
    gift: { description: skill.description, disc: skill.title, paragraph, title: skill.title },
    name: "",
  };
  const live = createRoomView(document, COLOURS, words);
  document.body.append(live.root);
  live.glyph!.src = "blob:runtime-glyph";
  const authored = createRoomView(document, COLOURS, words);
  expect(authored.glyph!.getAttribute("src")).toBeNull();
  expect(authored.panel!.portrait).not.toBe(live.panel!.portrait);
  expect(authored.leave.textContent).toBe(TEXT.dialogue.continue);
  live.root.remove();
});
