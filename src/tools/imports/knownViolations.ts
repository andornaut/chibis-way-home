// The violations the imports check still finds. Each list holds exactly the present ones of one
// rule, in alphabetical order. The check fails on a new one and on a listed one that no longer
// exists, so the table only shrinks.
// CLEANUP (added 2026-11-25): remove when the known-violations table is empty and ESLint guards
// the layers (cwh-0310).
import type { KnownViolations } from "./graph.ts";

export const KNOWN_VIOLATIONS: KnownViolations = {
  // Each import of a group in the same layer, a higher layer or no layer.
  direction: ["src/play.ts -> src/main.ts"],
  // Each importing group and the module it reaches past the entry of the module's group.
  entry: [
    "build -> src/loading/style.ts",
    "build -> src/pwa/cachePolicy.ts",
    "crash -> src/assets/birdFrame.ts",
    "crash -> src/ui/input/actionBinding.ts",
    "loading -> src/presentation/zoneTheme.ts",
    "loading -> src/ui/chrome/modalDim.ts",
    "loading -> src/ui/input/actionBinding.ts",
    "main.ts -> src/crash/crashScreen.ts",
    "main.ts -> src/scenes/AchievementNoticeScene.ts",
    "main.ts -> src/scenes/AchievementsScene.ts",
    "main.ts -> src/scenes/BootScene.ts",
    "main.ts -> src/scenes/CelebrationScene.ts",
    "main.ts -> src/scenes/CheatsScene.ts",
    "main.ts -> src/scenes/CutsceneScene.ts",
    "main.ts -> src/scenes/DeathScene.ts",
    "main.ts -> src/scenes/DialogueChoiceScene.ts",
    "main.ts -> src/scenes/DialogueScene.ts",
    "main.ts -> src/scenes/MapScene.ts",
    "main.ts -> src/scenes/OpeningScene.ts",
    "main.ts -> src/scenes/PauseScene.ts",
    "main.ts -> src/scenes/RestartScene.ts",
    "main.ts -> src/scenes/RoomScene.ts",
    "main.ts -> src/scenes/SettingsScene.ts",
    "main.ts -> src/scenes/SkillDetailScene.ts",
    "main.ts -> src/scenes/StageSelectScene.ts",
    "main.ts -> src/scenes/StartScene.ts",
    "main.ts -> src/scenes/UpdateScene.ts",
    "main.ts -> src/scenes/ZoneBarkScene.ts",
    "main.ts -> src/scenes/ZoneDepartureScene.ts",
    "main.ts -> src/scenes/ZoneIntroductionScene.ts",
    "main.ts -> src/scenes/ZoneScene.ts",
    "main.ts -> src/scenes/domUi.ts",
    "main.ts -> src/ui/input/frameTurn.ts",
    "play.ts -> src/crash/install.ts",
    "play.ts -> src/loading/presentation.ts",
    "play.ts -> src/loading/progress.ts",
    "play.ts -> src/loading/required.ts",
    "play.ts -> src/pwa/installOffer.ts",
    "pwa -> src/loading/launch.ts",
    "pwa -> src/loading/required.ts",
    "scenes -> src/loading/launch.ts",
    "scenes -> src/loading/progress.ts",
    "scenes -> src/loading/required.ts",
    "scenes -> src/progress/save/pageSave.ts",
    "scenes -> src/pwa/installOffer.ts",
    "scenes -> src/ui/input/frameTurn.ts",
  ],
  // Each group no layer places.
  unplaced: [],
};
