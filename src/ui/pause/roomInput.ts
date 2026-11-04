import { focusKeyAction } from "../focus";

// What the player does in a room: back, a key, or a press that went down on one control (or
// none) and lifted on one (or none). Leave is the room's only control.
export type RoomEvent =
  | { readonly kind: "back" }
  | {
      readonly key: string;
      readonly kind: "key";
      readonly repeat: boolean;
      readonly shift: boolean;
    }
  | {
      readonly down: "leave" | undefined;
      readonly kind: "press";
      readonly up: "leave" | undefined;
    };

// Whether Leave has the keyboard's focus, and whether she leaves.
export interface RoomOutcome {
  readonly focused: boolean;
  readonly leaves: boolean;
}

// What an event does in a room where Leave is focused or not: back, Escape, and a press that
// goes down and lifts on Leave each leave; Tab and the arrows focus Leave, and Enter and Space
// press it once focused. A held key's repeats never leave. P, which opens the pause card in
// play, does nothing here.
export function roomEvent(focused: boolean, event: RoomEvent): RoomOutcome {
  switch (event.kind) {
    case "back":
      return { focused, leaves: true };
    case "press":
      return { focused, leaves: event.down === "leave" && event.up === "leave" };
    default: {
      if (event.key === "Escape") {
        return { focused, leaves: !event.repeat };
      }
      const action = focusKeyAction(event.key, event.shift, event.repeat);
      if (action === "next" || action === "previous") {
        return { focused: true, leaves: false };
      }
      return { focused, leaves: action === "press" && focused };
    }
  }
}
