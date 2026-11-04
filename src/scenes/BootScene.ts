import {
  animationKey,
  type AsepriteSheet,
  sheetTags,
  tagRepeat,
} from "@andornaut/game-kit/art/aseprite";
import { type Loader, Scene } from "phaser";

import manifestJson from "../../public/art/manifest.json";
import { ART_MANIFEST_KEY, ART_PATH, type ArtManifest } from "../assets";
import { TILE } from "../data/screen";
import { startupLoading } from "../loading/progress";
import { launchReady } from "../pwa";
import { addAtlasArt, ATLAS, queueAtlasPages } from "./atlasArt";
import { filterFontArt, queueFontArt } from "./fontArt";
import { loadProgress } from "./save";

// The manifest ships inside the hashed bundle rather than loading from /art/, so a copy an earlier
// version cached can never be paired with this code.
const MANIFEST = manifestJson as ArtManifest;

// First scene to run. Loads everything art's manifest lists, makes an animation of every sprite
// tag, looping unless the manifest lists it as played once, then, once launchReady resolves,
// opens the start screen and launches the pause scene beside it.
export class BootScene extends Scene {
  constructor() {
    super("boot");
  }

  // Font PNG/FNT pairs load independently in both modes. A production build loads the
  // remaining game art from shared nearest-filtered atlas pages.
  preload(): void {
    this.load.on("progress", (fraction: number) => startupLoading.progress(fraction));
    this.load.once("complete", () => startupLoading.progress(undefined));
    this.load.on("loaderror", (file: Loader.File) => {
      console.warn(`Asset failed to load: ${file.key} (${file.url})`);
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
    filterFontArt(this, MANIFEST);
    if (ATLAS !== null) {
      addAtlasArt(this, ATLAS);
    }
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
    // Read progress and open the start screen after a pending version replacement can reload.
    // Diagnostic ?zone entry keeps its direct zone route.
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
          this.scene.start("start");
        }
      });
  }
}
