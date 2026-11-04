import { describe, expect, it } from "vitest";

import { cardBackAction, cardKeyAction, cardTurnAction, startBackAction } from "./cardInput";

describe("cardKeyAction", () => {
  it.each([
    { action: "open", key: "Escape", open: false, repeat: false },
    { action: "close", key: "Escape", open: true, repeat: false },
    { action: "open", key: "p", open: false, repeat: false },
    { action: "open", key: "P", open: false, repeat: false },
    { action: "close", key: "p", open: true, repeat: false },
    { action: undefined, key: "p", open: false, repeat: true },
    { action: undefined, key: "Escape", open: true, repeat: true },
    { action: undefined, key: "ArrowLeft", open: false, repeat: false },
    { action: undefined, key: " ", open: true, repeat: false },
  ])("$key with the card open $open, repeat $repeat: $action", ({ action, key, open, repeat }) => {
    expect(cardKeyAction(open, key, repeat)).toBe(action);
  });
});

describe("cardBackAction", () => {
  it.each([
    { action: "open", open: false },
    { action: "close", open: true },
  ])("with the card open $open: $action", ({ action, open }) => {
    expect(cardBackAction(open)).toBe(action);
  });
});

describe("startBackAction", () => {
  it.each([
    { action: "closeCard", canExit: true, cardOpen: true },
    { action: "closeCard", canExit: false, cardOpen: true },
    { action: "exit", canExit: true, cardOpen: false },
    { action: undefined, canExit: false, cardOpen: false },
  ])(
    "with a card open $cardOpen, Exit shown $canExit: $action",
    ({ action, canExit, cardOpen }) => {
      expect(startBackAction(cardOpen, canExit)).toBe(action);
    },
  );
});

describe("cardTurnAction", () => {
  it.each([
    { action: "open", open: false },
    { action: undefined, open: true },
  ])("with the card open $open: $action", ({ action, open }) => {
    expect(cardTurnAction(open)).toBe(action);
  });
});
