import "./crash/install";
import "@andornaut/game-kit/view/frameTurnLandscapeGame.css";
import "./main.css";

import { MENU_FPS } from "@andornaut/game-kit/clock/frameCap";
import { capFrameRate } from "@andornaut/game-kit/clock/phaser/capFrameRate";
import { lockGameOrientation } from "@andornaut/game-kit/view/frameTurn";
import { followFrameTurn } from "@andornaut/game-kit/view/phaser/followFrameTurn";
import { Game, Scale, WEBGL } from "phaser";

// eslint-disable-next-line no-duplicate-imports -- the side-effect import above runs it first.
import { CRASH_SCREEN } from "./crash/install";
import { SCREEN } from "./data/screen";
import { FRAME_TURN } from "./input/frameTurn";
import { setupPhoneApp } from "./pwa";
import { installOffer } from "./pwa/installOffer";
import { BootScene } from "./scenes/BootScene";
import { CelebrationScene } from "./scenes/CelebrationScene";
import { CutsceneScene } from "./scenes/CutsceneScene";
import { DeathScene } from "./scenes/DeathScene";
import { DialogueChoiceScene } from "./scenes/DialogueChoiceScene";
import { DialogueScene } from "./scenes/DialogueScene";
import { MapScene } from "./scenes/MapScene";
import { PauseScene } from "./scenes/PauseScene";
import { RestartScene } from "./scenes/RestartScene";
import { RoomScene } from "./scenes/RoomScene";
import { SettingsScene } from "./scenes/SettingsScene";
import { StageSelectScene } from "./scenes/StageSelectScene";
import { StartScene } from "./scenes/StartScene";
import { installUpdateModalBridge, UpdateScene } from "./scenes/UpdateScene";
import { ZoneBarkScene } from "./scenes/ZoneBarkScene";
import { ZoneDepartureScene } from "./scenes/ZoneDepartureScene";
import { ZoneIntroductionScene } from "./scenes/ZoneIntroductionScene";
import { ZoneScene } from "./scenes/ZoneScene";

// The page's ink background (public/site.css), which the canvas's bars match.
const INK = "#181425";

// Scale.EXPAND: the canvas fills #game, stretched by the most the base resolution can take on
// both axes, so where #game is wider or taller than 2:1 the canvas is too. Each scene shows the
// game's base-resolution view at the canvas's top, centred across (src/scenes/playCamera.ts), and
// the touch controls move into the bars beside or below it. pixelArt keeps the stretch
// nearest-neighbour. The game is constructed at once and loads while a fresh load
// checks for a newer version: BootScene holds only the zone for the check (launchReady).
function startGame(): void {
  const game = new Game({
    // The bars beside the game's view, in the page's ink.
    backgroundColor: INK,
    height: SCREEN.height,
    // Three touch pointers: a move touch, Jump and Use can all be held at once.
    input: { activePointers: 3 },
    parent: "game",
    pixelArt: true,
    // Lower input-to-screen delay: a desynchronized context lets the browser show a frame without
    // waiting on the page compositor, and the high-performance GPU where there is a choice.
    render: { antialias: false, desynchronized: true, powerPreference: "high-performance" },
    scale: { autoCenter: Scale.CENTER_HORIZONTALLY, mode: Scale.EXPAND },
    // Later scenes draw over earlier ones: the pause card over the zone, the settings card over
    // the pause card's dim, the restart card over the start screen or the celebration.
    scene: [
      BootScene,
      StartScene,
      MapScene,
      ZoneScene,
      ZoneBarkScene,
      CelebrationScene,
      CutsceneScene,
      PauseScene,
      RoomScene,
      SettingsScene,
      RestartScene,
      DialogueScene,
      ZoneDepartureScene,
      ZoneIntroductionScene,
      DialogueChoiceScene,
      DeathScene,
      StageSelectScene,
      UpdateScene,
    ],
    // WebGL only: the build's Phaser has no Canvas renderer (src/tools/phaserBuild.ts).
    type: WEBGL,
    width: SCREEN.width,
  });
  installUpdateModalBridge(game);
  // Phaser fits the canvas to #game and measures and maps pointers through the frame's turn, and
  // the page is kept to the visible area with the fit refreshed whenever it or the turn may have
  // changed (the kit's followFrameTurn).
  const parent = document.getElementById("game");
  if (parent !== null) {
    followFrameTurn(game, parent, FRAME_TURN, game.scale.gameSize);
  }
  // The pause card and BootScene draw at most about MENU_FPS frames a second; the zone, every
  // display frame.
  capFrameRate(MENU_FPS, () => game.scene.isActive("zone"), game);
  CRASH_SCREEN.stopGameOnCrash(() => game.pause());
}

// The browser's install prompt can come before the game draws, so the settings card's offer
// starts listening as the page loads.
installOffer();

// Asks for landscape, on the game page only; where the browser refuses, the frame turns.
lockGameOrientation(screen, "landscape");

setupPhoneApp();
startGame();
