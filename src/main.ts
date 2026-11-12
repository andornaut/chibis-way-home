import "@andornaut/game-kit/web/view/frameTurnLandscapeGame.css";
import "@andornaut/game-kit/web/ui/dom/ui.css";
import "./main.css";
import "./ui/dom/ui.css";
import "./ui/dom/achievements.css";
import "./ui/dom/runStats.css";
import "./ui/dom/death.css";
import "./ui/dom/stageSelect.css";
import "./ui/dom/skillDisc.css";
import "./ui/dom/actionHelp.css";
import "./ui/dom/pause.css";
import "./ui/dom/skillDetails.css";
import "./ui/dom/settings.css";
import "./dev/panel.css";

import { MENU_FPS } from "@andornaut/game-kit/clock/frameCap";
import { capFrameRate } from "@andornaut/game-kit/clock/phaser/capFrameRate";
import { LOADER_CONFIG } from "@andornaut/game-kit/load/loaderConfig";
import { MAX_RENDER_SCALE } from "@andornaut/game-kit/view/renderScale";
import { lockGameOrientation } from "@andornaut/game-kit/web/view/dom/watchFrameTurn";
import { followFrameTurn } from "@andornaut/game-kit/web/view/phaser/followFrameTurn";
import { Game, Scale, WEBGL } from "phaser";

import { CRASH_SCREEN } from "./crash/crashScreen.ts";
import { SCREEN } from "./data/screen.ts";
import { mountDeveloperPanel } from "./dev/panel.ts";
import { setupPhoneApp } from "./pwa/index.ts";
import { installOffer } from "./pwa/installOffer.ts";
import { AchievementNoticeScene } from "./scenes/AchievementNoticeScene.ts";
import { AchievementsScene } from "./scenes/AchievementsScene.ts";
import { BootScene } from "./scenes/BootScene.ts";
import { CelebrationScene } from "./scenes/CelebrationScene.ts";
import { CutsceneScene } from "./scenes/CutsceneScene.ts";
import { DeathScene } from "./scenes/DeathScene.ts";
import { DialogueChoiceScene } from "./scenes/DialogueChoiceScene.ts";
import { DialogueScene } from "./scenes/DialogueScene.ts";
import { mountDomUi } from "./scenes/domUi.ts";
import { MapScene } from "./scenes/MapScene.ts";
import { OpeningScene } from "./scenes/OpeningScene.ts";
import { PauseScene } from "./scenes/PauseScene.ts";
import { RestartScene } from "./scenes/RestartScene.ts";
import { RoomScene } from "./scenes/RoomScene.ts";
import { grantSavedSkills } from "./scenes/save.ts";
import { SettingsScene } from "./scenes/SettingsScene.ts";
import { SkillDetailScene } from "./scenes/SkillDetailScene.ts";
import { StageSelectScene } from "./scenes/StageSelectScene.ts";
import { StartScene } from "./scenes/StartScene.ts";
import { mountUiPresentation } from "./scenes/uiPresentation.ts";
import { installUpdateModalBridge, UpdateScene } from "./scenes/UpdateScene.ts";
import { ZoneBarkScene } from "./scenes/ZoneBarkScene.ts";
import { ZoneDepartureScene } from "./scenes/ZoneDepartureScene.ts";
import { ZoneIntroductionScene } from "./scenes/ZoneIntroductionScene.ts";
import { ZoneScene } from "./scenes/ZoneScene.ts";
import { FRAME_TURN } from "./ui/input/frameTurn.ts";

// The page's ink background (public/site.css), which the canvas's bars match.
const INK = "#181425";

// The canvas fills #game with its backing in device pixels, up to MAX_RENDER_SCALE per CSS pixel
// (followFrameTurn's deviceResolution, Scale.NONE), so where #game is wider or taller than 2:1
// the canvas is too. Each scene's cameras zoom the game's base resolution to fit, possibly
// fractionally, and show its view at the canvas's top, centred across (src/scenes/playCamera.ts),
// and every control stays in that view, clear of the bars beside or below it. Every texture
// samples nearest unless BootScene's filters (src/scenes/textureFilters.ts) or its own code make
// it linear, and the canvas itself is never smoothed. The UI overlay (mountUiPresentation) draws
// the UI scenes over the canvas at the full device pixel ratio, and the HTML UI layer
// (mountDomUi, src/ui/dom/) holds the screens moved to the page over both. The game is
// constructed at once and shows its first screen as soon as it has loaded; offline play never
// holds it.
function startGame(): void {
  const game = new Game({
    // The bars beside the game's view, in the page's ink.
    backgroundColor: INK,
    height: SCREEN.height,
    // Three touch pointers: a move touch, Jump and Use can all be held at once.
    input: { activePointers: 3 },
    // Each file request times out after 30 s and is tried twice more, so a load run always ends
    // (the kit's LOADER_CONFIG; its loader watch applies the timeout and retries later rounds).
    loader: LOADER_CONFIG,
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
    game.events.once("destroy", mountDomUi(game, gameHost));
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
