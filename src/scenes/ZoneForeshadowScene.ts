import { DialogueScene } from "./DialogueScene";

// Only dialogue-owned controls consume input; the zone continues underneath this panel.
export class ZoneForeshadowScene extends DialogueScene {
  constructor() {
    super("zoneForeshadow", false, true);
  }
}
