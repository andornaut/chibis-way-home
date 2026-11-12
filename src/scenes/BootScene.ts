import {
  animationKey,
  type AsepriteSheet,
  sheetTags,
  tagRepeat,
} from "@andornaut/game-kit/art/aseprite";
import { watchLoader } from "@andornaut/game-kit/load/phaser/watchLoader";
import type { ProgressHandle } from "@andornaut/game-kit/progressState";
import type { RequiredUpdateState } from "@andornaut/game-kit/web/pwa/updateReady";
import { Scene } from "phaser";

import manifestJson from "../../public/art/manifest.json";
import { ART_MANIFEST_KEY, ART_PATH, type ArtManifest } from "../assets";
import { TILE } from "../data/screen";
import { TEXT } from "../data/text";
import {
  beginRequiredUpdate,
  beginStartupChecks,
  loadingProgress,
  startupLoading,
} from "../loading/progress";
import { requiredUpdate, requireNewer } from "../pwa";
import { createMessageCard } from "../ui";
import { ACHIEVEMENT_NOTICE } from "./achievementNotice";
import { addAtlasArt, ATLAS, queueAtlasPages } from "./atlasArt";
import { mountSceneView, prepareDomUi } from "./domUi";
import { queueFontArt } from "./fontArt";
import { loadProgress } from "./save";
import { filterLoadedArt } from "./textureFilters";

// The manifest ships inside the hashed bundle rather than loading from /art/, so a copy an earlier
// version cached can never be paired with this code.
const MANIFEST = manifestJson as ArtManifest;

// First scene to run. Loads everything art's manifest lists, makes an animation of every sprite
// tag, looping unless the manifest lists it as played once, then, once the save is read, opens the
// start screen and launches the pause scene beside it, or updates the game where a newer version
// wrote the save.
export class BootScene extends Scene {
  // The startup checks' pending phase, after the measured file load.
  private startupChecks?: ProgressHandle;

  constructor() {
    super("boot");
  }

  // Font PNG/FNT pairs load independently in both modes. A production build loads the
  // remaining game art from shared atlas pages. create filters every texture (textureFilters.ts).
  // The kit's loader watch measures the file load as one the player waits for, which the bar
  // shows by its settled files, and logs and retries failed files; it ends with the scene.
  preload(): void {
    watchLoader({ console, progress: loadingProgress, timer: window }, this).waitFor("boot");
    this.load.once("complete", () => {
      this.startupChecks = beginStartupChecks();
    });
    if (ATLAS !== null) {
      queueAtlasPages(this, ATLAS);
    }
    this.load.setPath(ART_PATH);
    this.cache.json.add(ART_MANIFEST_KEY, MANIFEST);
    for (const { json, key } of MANIFEST.data) {
      this.load.json(key, json);
    }
    for (const { json, key } of MANIFEST.tilesets) {
      this.load.json(key, json);
    }
    // Standalone images are excluded from the atlas and loaded in both rendering modes.
    for (const { key, png } of MANIFEST.images) {
      this.load.image(key, png);
    }
    queueFontArt(this, MANIFEST);
    if (ATLAS !== null) {
      return;
    }
    for (const { json, key, png } of MANIFEST.sprites) {
      this.load.aseprite(key, png, json);
    }
    for (const { key, png } of MANIFEST.tilesets) {
      this.load.spritesheet(key, png, { frameHeight: TILE, frameWidth: TILE });
    }
    for (const { key, png } of MANIFEST.backdrops) {
      this.load.image(key, png);
    }
  }

  create(): void {
    if (ATLAS !== null) {
      addAtlasArt(this, ATLAS);
    }
    filterLoadedArt(this, MANIFEST, ATLAS);
    for (const { key, once } of MANIFEST.sprites) {
      const sheet = this.cache.json.get(key) as AsepriteSheet;
      for (const [tag, frames] of sheetTags(sheet)) {
        this.anims.create({
          frames: frames.map(({ duration, frame }) => ({ duration, frame, key })),
          key: animationKey(key, tag),
          repeat: tagRepeat(once, tag),
        });
      }
    }
    if (new URLSearchParams(window.location.search).has("stagePreview")) {
      this.scene.start("zone");
      return;
    }
    // Read progress and open the start screen at once, with no wait for offline play, once the
    // HTML UI has its fonts and art. Diagnostic ?zone entry keeps its direct zone route.
    const domUi = prepareDomUi(this);
    void loadProgress().then(async (age) => {
      if (age === "newer") {
        this.updateForNewerSave(domUi);
        return;
      }
      await domUi;
      const rendered = () => {
        if (this.game.canvas.style.visibility === "hidden") {
          this.game.events.once("postrender", rendered);
        } else {
          (this.startupChecks ?? startupLoading).finish();
        }
      };
      this.game.events.once("postrender", rendered);
      this.scene.launch("pause");
      this.scene.launch(ACHIEVEMENT_NOTICE);
      if (new URLSearchParams(window.location.search).has("zone")) {
        this.scene.start("zone");
      } else {
        this.scene.start("start");
      }
    });
  }

  // A save a newer version wrote: the game updates by itself (requireNewer), never opens Start
  // and writes nothing. The game loop sleeps, so the main thread stays idle and the browser
  // starts the install at once; the DOM loading bar animates in CSS and the message needs no
  // frames. "updating" shows the travelling loading bar, and "unavailable" the connect message
  // once the HTML UI has its fonts and art; the kit retries on its own.
  private updateForNewerSave(domUi: Promise<void>): void {
    this.game.loop.sleep();
    (this.startupChecks ?? startupLoading).finish();
    let state: RequiredUpdateState | undefined;
    let updating: ProgressHandle | undefined;
    let message: (() => void) | undefined;
    requiredUpdate.subscribe((next) => {
      state = next;
      if (next === "updating") {
        message?.();
        message = undefined;
        updating ??= beginRequiredUpdate();
        return;
      }
      updating?.finish();
      updating = undefined;
      void domUi.then(() => {
        if (state === "unavailable" && message === undefined) {
          message = mountSceneView(
            this,
            createMessageCard(document, "connect-card", TEXT.update.connect),
          );
        }
      });
    });
    requireNewer();
  }
}
