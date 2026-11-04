// What the player's keys and back do to the pause card, and what back does on the start screen.
export type CardAction = "close" | "open";

// The keys that open the card during play and close it when open.
const CARD_KEYS = new Set(["Escape", "P", "p"]);

// A key's action, or undefined for any other key or a held key's repeats.
export function cardKeyAction(open: boolean, key: string, repeat: boolean): CardAction | undefined {
  if (repeat || !CARD_KEYS.has(key)) {
    return undefined;
  }
  return open ? "close" : "open";
}

// Back opens the card during play and closes it when open.
export function cardBackAction(open: boolean): CardAction {
  return open ? "close" : "open";
}

// A change of the page frame's turn (unturned to turned, back, or the direction flipping) opens
// the card during play, as P does, and leaves an open card as it is.
export function cardTurnAction(open: boolean): CardAction | undefined {
  return open ? undefined : "open";
}

// What back does on the start screen.
export type StartBackAction = "closeCard" | "exit";

// Back closes the card that shows (the settings card or its install steps, or the restart card),
// and otherwise leaves the game as Exit does. Where the start screen shows no Exit, back does
// nothing.
export function startBackAction(cardOpen: boolean, canExit: boolean): StartBackAction | undefined {
  if (cardOpen) {
    return "closeCard";
  }
  return canExit ? "exit" : undefined;
}
