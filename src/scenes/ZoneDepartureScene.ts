import { DialogueScene } from "./DialogueScene";

// The exchange consumes normal dialogue input over an opaque black departure view.
export class ZoneDepartureScene extends DialogueScene {
  constructor() {
    super("zoneDeparture", true);
  }
}
