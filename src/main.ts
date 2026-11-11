import "./crash/install";
import "@andornaut/game-kit/web/view/frameTurnLandscapeGame.css";
import "./main.css";
import "./dev/panel.css";

import { MENU_FPS } from "@andornaut/game-kit/clock/frameCap";
import { capFrameRate } from "@andornaut/game-kit/clock/phaser/capFrameRate";
import { MAX_RENDER_SCALE } from "@andornaut/game-kit/view/renderScale";
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

// The canvas fills #game with its backing in device pixels, up to MAX_RENDER_SCALE per CSS pixel
// (followFrameTurn's deviceResolution, Scale.NONE), so where #game is wider or taller than 2:1
// the canvas is too. Each scene's cameras zoom the game's base resolution to fit, possibly
// fractionally, and show its view at the canvas's top, centred across (src/scenes/playCamera.ts),
// and every control stays in that view, clear of the bars beside or below it. Every texture
// samples nearest unless BootScene's filters (src/scenes/textureFilters.ts) or its own code make
// it linear, and the canvas itself is never smoothed. The UI overlay (mountUiPresentation) draws
// the UI scenes over the canvas at the full device pixel ratio. The game is constructed at once
// and loads while a fresh load checks for a newer version: BootScene holds only the zone for the
// check (launchReady).
function startGame(): void {
  const game = new Game({
    // The bars beside the game's view, in the page's ink.
    backgroundColor: INK,
    height: SCREEN.height,
    // Three touch pointers: a move touch, Jump and Use can all be held at once.
    input: { activePointers: 3 },
    parent: "game",
    // Lower input-to-screen delay: a desynchronized context lets the browser show a frame without
    // waiting on the page compositor, and the high-performance GPU where there is a choice.
    render: {
      antialias: false,
      antialiasGL: false,
      desynchronized: true,
      powerPreference: "high-performance",
      roundPixels: true,
    },
    scale: { autoCenter: Scale.CENTER_HORIZONTALLY, mode: Scale.NONE },
    // Later scenes draw over earlier ones and take presses first: the pause button and card over
    // the zone and its conversations, the settings card over the pause card's dim, the restart
    // card over the start screen or the celebration, and unlock notices over play and under every
    // card.
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
      DialogueScene,
      ZoneIntroductionScene,
      DialogueChoiceScene,
      ZoneDepartureScene,
      PauseScene,
      RoomScene,
      SettingsScene,
      SkillDetailScene,
      RestartScene,
      AchievementsScene,
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
    followFrameTurn(FRAME_TURN, game.scale.gameSize, parent, game, {
      deviceResolution: { max: MAX_RENDER_SCALE },
    });
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
