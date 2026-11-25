// The press and hold binding of the game's DOM controls, which the crash screen and the loading
// failure card also use, so it stays apart from the rest of the interface.
export {
  assertGameActions,
  bindFactoryAction,
  bindGameActions,
  bindNativeGameActions,
  createGameButton,
  createGameFormRow,
  createGameHudDisc,
  createGamePager,
  disposeGameButtons,
  type GameAction,
  type GameActionOptions,
  type GamePager,
} from "./actionBinding.ts";
