import { type CutsceneData, CutsceneScene } from "./CutsceneScene";
import type { DialogueOpener } from "./DialogueScene";

export interface ZoneDepartureData extends CutsceneData {
  readonly cleared: boolean;
}

// The required summary returns through the existing map or celebration continuation.
export class ZoneDepartureScene extends CutsceneScene {
  constructor() {
    super("zoneDeparture");
  }
  protected override finish(): void {
    this.scene.stop();
    const opener = this.scene.get("zone") as unknown as DialogueOpener;
    opener.dialogueClosed();
  }
}
