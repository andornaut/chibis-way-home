// The code points the served faces must map: every player-visible string and the characters the
// game composes at runtime. The art font subset build imports this module under plain Node, so it
// and its imports use no bundler features, DOM globals or Phaser.
import { readFileSync } from "node:fs";

import { UNKNOWN_COMMIT } from "@andornaut/game-kit/build/buildVersion";
import { buildLabel } from "@andornaut/game-kit/runtime/web/buildLabel";

import * as achievements from "../../data/achievements.ts";
import * as characters from "../../data/characters.ts";
import * as crashText from "../../data/crashText.ts";
import * as dev from "../../data/dev.ts";
import * as dialogues from "../../data/dialogues.ts";
import * as text from "../../data/text.ts";
import * as zones from "../../data/zones.ts";
import { timeText } from "../../progress/index.ts";

// Every exported value of these modules is walked.
const STRING_SOURCES = { achievements, characters, crashText, dev, dialogues, text, zones };

const PACKAGE_JSON = new URL("../../../package.json", import.meta.url);

// Placeholders are filled at runtime; their values are counted separately below.
const PLACEHOLDER = /\{[^{}]+\}/gu;
// C0 and C1 controls, such as newline, are layout, not glyphs.
const CONTROL = /^\p{Cc}$/u;

function addCodePoints(target: Set<number>, value: string): void {
  for (const character of value.replace(PLACEHOLDER, "")) {
    if (!CONTROL.test(character)) {
      target.add(character.codePointAt(0)!);
    }
  }
}

function collectStrings(target: Set<number>, value: unknown, seen = new Set<object>()): void {
  if (typeof value === "string") {
    addCodePoints(target, value);
    return;
  }
  if (value === null || typeof value !== "object" || seen.has(value)) {
    return;
  }
  seen.add(value);
  for (const child of Object.values(value)) {
    collectStrings(target, child, seen);
  }
}

// Characters the game composes at runtime: counts, percentages and stage numbers, timer text and
// the build label, whose version comes from package.json and whose commit is eight lowercase hex
// digits of a commit hash or the kit's unknown-commit word.
function runtimeCodePoints(): Set<number> {
  const target = new Set<number>();
  addCodePoints(target, "0123456789");
  for (let seconds = 0; seconds < 3600; seconds += 1) {
    addCodePoints(target, timeText(seconds));
  }
  const { version } = JSON.parse(readFileSync(PACKAGE_JSON, "utf8")) as { version: string };
  addCodePoints(target, buildLabel(version, "0123456789abcdef"));
  addCodePoints(target, buildLabel(version, UNKNOWN_COMMIT));
  return target;
}

export function playerCodePoints(): Set<number> {
  const target = runtimeCodePoints();
  collectStrings(target, STRING_SOURCES);
  return target;
}
