import type { DialoguePlan, DialogueSpeaker } from "./types";

// Linear conversations, with paragraph text in TEXT.lines.
export const DIALOGUES: Readonly<Record<string, DialoguePlan>> = {
  "depot-dog-intro": {
    lines: [
      { line: "depot-dog-intro-1", speaker: "dog" },
      { line: "depot-dog-intro-2", speaker: "bird" },
      { line: "depot-dog-intro-3", speaker: "dog" },
    ],
  },
};

// Portraits and name-tab colours shared by every line from a speaker.
export const SPEAKERS: Readonly<Record<string, DialogueSpeaker>> = {
  bird: { colour: "amber", portrait: "portrait-bird", side: "left" },
  dog: { colour: "green", portrait: "portrait-dog", side: "right" },
};
