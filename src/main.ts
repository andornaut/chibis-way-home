import "./crash/install";
import "@andornaut/game-kit/web/view/frameTurnLandscapeGame.css";
import "./main.css";
import "./dev/panel.css";

import { MENU_FPS } from "@andornaut/game-kit/clock/frameCap";
import { capFrameRate } from "@andornaut/game-kit/clock/phaser/capFrameRate";
import { lockGameOrientation } from "@andornaut/game-kit/web/view/dom/watchFrameTurn";
import { followFrameTurn } from "@andornaut/game-kit/web/view/phaser/followFrameTurn";
import { Game, Scale, WEBGL } from "phaser";

// eslint-disable-next-line no-duplicate-imports -- the side-effect import above runs it first.
import { CRASH_SCREEN } from "./crash/install";
import { SCREEN } from "./data/screen";
import { mountDeveloperPanel } from "./dev/panel";
import { setupPhoneApp } from "./pwa";
import { installOffer } from "./pwa/installOffer";
import { AchievementNoticeScene } from "./scenes/AchievementNoticeScene";
import { AchievementsScene } from "./scenes/AchievementsScene";
import { BootScene } from "./scenes/BootScene";
import { CelebrationScene } from "./scenes/CelebrationScene";
import { CutsceneScene } from "./scenes/CutsceneScene";
import { DeathScene } from "./scenes/DeathScene";
import { DialogueChoiceScene } from "./scenes/DialogueChoiceScene";
import { DialogueScene } from "./scenes/DialogueScene";
import { MapScene } from "./scenes/MapScene";
import { OpeningScene } from "./scenes/OpeningScene";
import { PauseScene } from "./scenes/PauseScene";
import { RestartScene } from "./scenes/RestartScene";
import { RoomScene } from "./scenes/RoomScene";
import { grantSavedSkills } from "./scenes/save";
import { SettingsScene } from "./scenes/SettingsScene";
import { SkillDetailScene } from "./scenes/SkillDetailScene";
import { StageSelectScene } from "./scenes/StageSelectScene";
import { StartScene } from "./scenes/StartScene";
import { mountUiPresentation } from "./scenes/uiPresentation";
import { installUpdateModalBridge, UpdateScene } from "./scenes/UpdateScene";
import { ZoneBarkScene } from "./scenes/ZoneBarkScene";
import { ZoneDepartureScene } from "./scenes/ZoneDepartureScene";
import { ZoneIntroductionScene } from "./scenes/ZoneIntroductionScene";
import { ZoneScene } from "./scenes/ZoneScene";
import { FRAME_TURN } from "./ui/input/frameTurn";

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
    // the pause card's dim, the restart card over the start screen or the celebration, and unlock
    // notices over play and under every card.
    scene: [
      BootScene,
      StartScene,
      OpeningScene,
      MapScene,
      ZoneScene,
      ZoneBarkScene,
      AchievementNoticeScene,
      CelebrationScene,
      CutsceneScene,
      PauseScene,
      RoomScene,
      SettingsScene,
      SkillDetailScene,
      RestartScene,
      AchievementsScene,
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
  mountUiPresentation(game);
  installUpdateModalBridge(game);
  const gameHost = document.getElementById("game");
  if (gameHost) {
    const dispose = mountDeveloperPanel(
      {
        blocked: () =>
          gameHost.hasAttribute("data-modal-open") ||
          game.scene.isActive("boot") ||
          (game.scene.isActive("zone") && (game.scene.getScene("zone") as ZoneScene).playCovered()),
        grant: grantSavedSkills,
        subscribe: (sync) => {
          game.events.on("poststep", sync);
          return () => game.events.off("poststep", sync);
        },
      },
      gameHost,
    );
    game.events.once("destroy", dispose);
  }
  // Phaser fits the canvas to #game and measures and maps pointers through the frame's turn, and
  // the page is kept to the visible area with the fit refreshed whenever it or the turn may have
  // changed (the kit's followFrameTurn).
  const parent = document.getElementById("game");
  if (parent !== null) {
    followFrameTurn(FRAME_TURN, game.scale.gameSize, parent, game);
  }
  // Menus draw at most about MENU_FPS frames a second; gameplay and the animated opening draw
  // every display frame.
  capFrameRate(MENU_FPS, () => game.scene.isActive("zone") || game.scene.isActive("opening"), game);
  CRASH_SCREEN.stopGameOnCrash(() => game.pause());
}

// The browser's install prompt can come before the game draws, so the settings card's offer
// starts listening as the page loads.
installOffer();

// Asks for landscape, on the game page only; where the browser refuses, the frame turns.
lockGameOrientation("landscape", screen);

setupPhoneApp();
startGame();
