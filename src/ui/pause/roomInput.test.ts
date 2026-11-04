import { describe, expect, it } from "vitest";

import { type RoomEvent, roomEvent, type RoomOutcome } from "./roomInput";

const key = (name: string, repeat = false, shift = false): RoomEvent => ({
  key: name,
  kind: "key",
  repeat,
  shift,
});

describe("roomEvent", () => {
  it.each<[string, boolean, RoomEvent, RoomOutcome]>([
    ["back leaves", false, { kind: "back" }, { focused: false, leaves: true }],
    ["Escape leaves", false, key("Escape"), { focused: false, leaves: true }],
    [
      "a held Escape's repeat does not",
      false,
      key("Escape", true),
      { focused: false, leaves: false },
    ],
    [
      "a press down and up on Leave leaves",
      false,
      { down: "leave", kind: "press", up: "leave" },
      { focused: false, leaves: true },
    ],
    [
      "a press that lifts off Leave does not",
      false,
      { down: "leave", kind: "press", up: undefined },
      { focused: false, leaves: false },
    ],
    [
      "a press that went down elsewhere does not",
      false,
      { down: undefined, kind: "press", up: "leave" },
      { focused: false, leaves: false },
    ],
    ["Tab focuses Leave", false, key("Tab"), { focused: true, leaves: false }],
    ["Shift+Tab focuses Leave", false, key("Tab", false, true), { focused: true, leaves: false }],
    ["Enter with Leave focused leaves", true, key("Enter"), { focused: true, leaves: true }],
    ["Space with Leave focused leaves", true, key(" "), { focused: true, leaves: true }],
    ["Enter with nothing focused does not", false, key("Enter"), { focused: false, leaves: false }],
    ["P does nothing", false, key("P"), { focused: false, leaves: false }],
  ])("%s", (_, focused, event, outcome) => {
    expect(roomEvent(focused, event)).toEqual(outcome);
  });
});
