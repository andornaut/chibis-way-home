import {
  animationKey,
  type AsepriteSheet,
  sheetTags,
  tagRepeat,
} from "@andornaut/game-kit/art/aseprite";
import { Scene } from "phaser";

import { TILE } from "../data/screen";
import { startupLoading } from "../loading/progress";
import { launchReady } from "../pwa";
import { loadProgress, savedProgress } from "../save";
import { ART_MANIFEST_FILE, ART_MANIFEST_KEY, ART_PATH, type ArtManifest } from "../view/aseprite";
import { addAtlasArt, ATLAS, queueAtlasFonts, queueAtlasPages } from "./atlasArt";

// First scene to run. Loads everything art's manifest lists, makes an animation of every sprite
// tag, looping unless the manifest lists it as played once, then, once launchReady resolves,
// starts the test zone and the pause scene beside it.
export class BootScene extends Scene {
  constructor() {
    super("boot");
  }

  // A build loads its atlas pages, in parallel with the manifest, and each font's .fnt: every
  // game PNG listed outside standalone images is on the pages. The dev server has no atlas, so
  // each art file loads on its own there and every edit shows on reload.
  preload(): void {
    this.load.on("progress", (fraction: number) => startupLoading.progress(fraction));
    this.load.once("complete", () => startupLoading.progress(undefined));
    if (ATLAS !== null) {
      queueAtlasPages(this, ATLAS);
    }
    this.load.setPath(ART_PATH);
    this.load.json(ART_MANIFEST_KEY, ART_MANIFEST_FILE);
    this.load.once(`filecomplete-json-${ART_MANIFEST_KEY}`, () => {
      const manifest = this.manifest();
      for (const { json, key } of manifest.data) {
        this.load.json(key, json);
      }
      for (const { json, key } of manifest.tilesets) {
        this.load.json(key, json);
      }
      // Standalone images are excluded from the atlas and loaded in both rendering modes.
      for (const { key, png } of manifest.images) {
        this.load.image(key, png);
      }
      if (ATLAS !== null) {
        queueAtlasFonts(this, manifest);
        return;
      }
      for (const { json, key, png } of manifest.sprites) {
        this.load.aseprite(key, png, json);
      }
      for (const { fnt, key, png } of manifest.fonts) {
        this.load.bitmapFont(key, png, fnt);
      }
      for (const { key, png } of manifest.tilesets) {
        this.load.spritesheet(key, png, { frameHeight: TILE, frameWidth: TILE });
      }
      for (const { key, png } of manifest.backdrops) {
        this.load.image(key, png);
      }
    });
  }

  create(): void {
    if (ATLAS !== null) {
      addAtlasArt(this, ATLAS, this.manifest());
    }
    for (const { key, once } of this.manifest().sprites) {
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
    // The zone shows, and the save is read, once a version about to be replaced by a newer one
    // has had its chance to reload first, so it never draws the old zone or reads the save with
    // the old format. Saved progress opens the map where she stands; without any, the start
    // screen comes first. ?zone=<n> plays the zones straight through.
    void launchReady()
      .then(loadProgress)
      .then(() => {
        const rendered = () => {
          if (this.game.canvas.style.visibility === "hidden") {
            this.game.events.once("postrender", rendered);
          } else {
            startupLoading.finish();
          }
        };
        this.game.events.once("postrender", rendered);
        this.scene.launch("pause");
        if (new URLSearchParams(window.location.search).has("zone")) {
          this.scene.start("zone");
        } else {
          this.scene.start(savedProgress().at === "beginning" ? "start" : "map");
        }
      });
  }

  private manifest(): ArtManifest {
    return this.cache.json.get(ART_MANIFEST_KEY) as ArtManifest;
  }
}
