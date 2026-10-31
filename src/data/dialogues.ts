import type { DialoguePlan, DialogueSpeaker } from "./types";

// Linear conversations, with paragraph text in TEXT.lines.
export const DIALOGUES: Readonly<Record<string, DialoguePlan>> = {
  "archie-outro": {
    lines: [
      { line: "archie-outro-1", speaker: "dog" },
      { line: "archie-outro-2", speaker: "bird" },
    ],
  },
  "bini-intro": {
    lines: [
      { line: "bini-intro-1", speaker: "bear" },
      { line: "bini-intro-2", speaker: "bird" },
      { line: "bini-intro-3", speaker: "bear" },
    ],
  },
  "bini-outro": {
    lines: [
      { line: "bini-outro-1", speaker: "bear" },
      { line: "bini-outro-2", speaker: "bird" },
    ],
  },
  "depot-dog-intro": {
    lines: [
      { line: "depot-dog-intro-1", speaker: "dog" },
      { line: "depot-dog-intro-2", speaker: "bird" },
      { line: "depot-dog-intro-3", speaker: "dog" },
    ],
  },
  "furt-intro": {
    lines: [
      { line: "furt-intro-1", speaker: "ferret" },
      { line: "furt-intro-2", speaker: "bird" },
      { line: "furt-intro-3", speaker: "ferret" },
    ],
  },
  "furt-outro": {
    lines: [
      { line: "furt-outro-1", speaker: "ferret" },
      { line: "furt-outro-2", speaker: "bird" },
    ],
  },
  "kiwi-intro": {
    lines: [
      { line: "kiwi-intro-1", speaker: "raccoon" },
      { line: "kiwi-intro-2", speaker: "bird" },
      { line: "kiwi-intro-3", speaker: "raccoon" },
    ],
  },
  "kiwi-outro": {
    lines: [
      { line: "kiwi-outro-1", speaker: "raccoon" },
      { line: "kiwi-outro-2", speaker: "bird" },
    ],
  },
  "pebble-intro": {
    lines: [
      { line: "pebble-intro-1", speaker: "pigeon" },
      { line: "pebble-intro-2", speaker: "bird" },
      { line: "pebble-intro-3", speaker: "pigeon" },
    ],
  },
  "pebble-outro": {
    lines: [
      { line: "pebble-outro-1", speaker: "pigeon" },
      { line: "pebble-outro-2", speaker: "bird" },
    ],
  },
  "trixi-intro": {
    lines: [
      { line: "trixi-intro-1", speaker: "goose" },
      { line: "trixi-intro-2", speaker: "bird" },
      { line: "trixi-intro-3", speaker: "goose" },
    ],
  },
  "trixi-outro": {
    lines: [
      { line: "trixi-outro-1", speaker: "goose" },
      { line: "trixi-outro-2", speaker: "bird" },
    ],
  },
};

// Portraits and name-tab colours shared by every line from a speaker.
export const SPEAKERS: Readonly<Record<string, DialogueSpeaker>> = {
  bear: { colour: "tan", portrait: "portrait-bear", side: "right" },
  bird: { colour: "amber", portrait: "portrait-bird", side: "left" },
  dog: { colour: "green", portrait: "portrait-dog", side: "right" },
};
