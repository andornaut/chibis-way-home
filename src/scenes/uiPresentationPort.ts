import type { Rect } from "@andornaut/game-kit/rect";
import type { UiSnapshotResult } from "@andornaut/game-kit/view/phaser/uiCommands";
import type { Game, Scene } from "phaser";

interface UiSnapshotHandle {
  readonly ready: Promise<UiSnapshotResult>;
  destroy(): void;
}
interface GameUiPresentation {
  capture(
    scene: Scene,
    area: Rect,
    remap: (colour: number) => number,
  ): UiSnapshotHandle | undefined;
  fallback(): void;
}
const presentations = new WeakMap<Game, GameUiPresentation>();
export function gameUiPresentation(game: Game): GameUiPresentation | undefined {
  return presentations.get(game);
}
export function bindGameUiPresentation(game: Game, presentation: GameUiPresentation): () => void {
  presentations.set(game, presentation);
  return () => {
    if (presentations.get(game) === presentation) {
      presentations.delete(game);
    }
  };
}
