import { describe, expect, it } from "vitest";

import * as behaviours from "../../data/behaviours.ts";
import { CHARACTERS } from "../../data/characters.ts";
import { DIALOGUES, SPEAKERS } from "../../data/dialogues.ts";
import { STAGE_BARKS } from "../../data/stageBarks.ts";
import { TEXT } from "../../data/text.ts";
import type { DialogueLine, Rect } from "../../data/types/index.ts";
import { SKILL_IDS } from "../../progress/index.ts";
import { dialogueParagraphs } from "../dialogue/conversation.ts";
import {
  DIALOGUE_PORTRAIT_SIZE,
  DIALOGUE_SCREEN,
  dialogueNameTab,
  dialogueSpeakerLayout,
} from "./dialogueScreen.ts";
import { skillButton, skillHud } from "./skillHud.ts";

const { box } = DIALOGUE_SCREEN;

describe("dialogue layout", () => {
  it("keeps the panel and native text column below the skill HUD", () => {
    const hudBottom = Math.max(
      ...[...skillHud(SKILL_IDS).values()]
        .map((at) => skillButton(at).hit)
        .map((hit) => hit.y + hit.height),
    );
    expect(box).toEqual({ height: 60, width: 480, x: 120, y: 76 });
    expect(dialogueNameTab("left", 0).y).toBe(66);
    expect(dialogueNameTab("left", 0).y).toBeGreaterThan(hudBottom);
    expect(DIALOGUE_SCREEN.text).toMatchObject({ lines: 2, pitch: 20, width: 408 });
  });

  it.each([
    ["left", { frameX: 124, slotX: 126, textX: 184 }],
    ["right", { frameX: 544, slotX: 546, textX: 128 }],
  ] as const)("places the %s portrait frame, slot and native text column", (side, at) => {
    const layout = dialogueSpeakerLayout(side);
    const frameY = box.y + 4;
    expect(layout.portraitFrame).toEqual({ height: 52, width: 52, x: at.frameX, y: frameY });
    expect(layout.portrait).toEqual({ x: at.slotX, y: frameY + 2 });
    expect(DIALOGUE_PORTRAIT_SIZE).toBe(48);
    expect(layout.textX).toBe(at.textX);
    const [near, far] =
      side === "left"
        ? [layout.textX - layout.portraitFrame.x - 52, box.x + box.width - layout.textX - 408]
        : [layout.portraitFrame.x - layout.textX - 408, layout.textX - box.x];
    expect({ far, near }).toEqual({ far: 8, near: 8 });
  });

  it.each([
    ["left", (tab: Rect) => tab.x + tab.width, 592],
    ["right", (tab: Rect) => tab.x, 128],
  ] as const)("anchors the %s name tab beside its portrait", (side, edge, at) => {
    const tab = dialogueNameTab(side, 48);
    expect(edge(tab)).toBe(at);
    expect(tab).toMatchObject({ height: 20, width: 60, y: 66 });
    expect(box.y - tab.y).toBe(10);
    const frame = dialogueSpeakerLayout(side).portraitFrame;
    expect(tab.x >= frame.x + frame.width || tab.x + tab.width <= frame.x).toBe(true);
  });
});

function barkLines(...sources: readonly unknown[]): readonly DialogueLine[] {
  const found = new Map<string, DialogueLine>();
  const visit = (value: unknown): void => {
    if (typeof value !== "object" || value === null) {
      return;
    }
    const { line, speaker } = value as Partial<DialogueLine>;
    if (typeof line === "string" && typeof speaker === "string") {
      found.set(`${speaker} ${line}`, { line, speaker });
    }
    Object.values(value).forEach(visit);
  };
  sources.forEach(visit);
  return [...found.values()];
}

it("resolves every authored dialogue paragraph for the native panel", () => {
  for (const plan of Object.values(DIALOGUES)) {
    expect(dialogueParagraphs(SPEAKERS, TEXT, plan)).toHaveLength(plan.lines.length);
  }
});

it("resolves boss barks and journey statements for the native panel", () => {
  const lines = barkLines(behaviours, CHARACTERS, STAGE_BARKS);
  for (const kind of ["-escaped", "-spotted", "fert-journey-"]) {
    expect(
      lines.some(({ line }) => line.includes(kind)),
      kind,
    ).toBe(true);
  }
  for (const line of lines) {
    expect(dialogueParagraphs(SPEAKERS, TEXT, { lines: [line] })[0]?.text).toBe(
      TEXT.lines[line.line],
    );
  }
});
