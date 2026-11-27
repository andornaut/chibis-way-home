import {
  animationKey,
  type AsepriteSheet,
  sheetTags,
  tagRepeat,
} from "@andornaut/game-kit/runtime/art/aseprite";
import { createLoadingAttempts } from "@andornaut/game-kit/runtime/load/loadingAttempts";
import {
  type LoaderWatch,
  type LoadFailure,
  watchLoader,
} from "@andornaut/game-kit/runtime/load/phaser/watchLoader";
import type { ProgressHandle } from "@andornaut/game-kit/runtime/progressState";
import type { RequiredUpdateState } from "@andornaut/game-kit/runtime/web/pwa/dom/launch";
import { Scene } from "phaser";

import manifestJson from "../../../public/art/manifest.json" with { type: "json" };
import {
  ART_MANIFEST_KEY,
  ART_PATH,
  type ArtManifest,
  atlasPageKey,
  BUNDLED_ART_DATA,
} from "../../assets/index.ts";
import { TILE } from "../../data/screen.ts";
import { TEXT } from "../../data/text.ts";
import {
  beginRequiredUpdate,
  beginStartupChecks,
  launchLoading,
  observeRequiredAttempt,
  requiredLoading,
  startupLoading,
} from "../../loading/index.ts";
import { requiredUpdate, requireNewer } from "../../pwa/index.ts";
import { createMessageCard, UI_FRAMES } from "../../ui/index.ts";
import { ACHIEVEMENT_NOTICE } from "../achievementNotice.ts";
import { mountSceneView, prepareDomUi } from "../domUi.ts";
import { loadProgress, probeSaveAge } from "../save.ts";
import { addAtlasArt, ATLAS, queueAtlasPages } from "./atlasArt.ts";
import { filterLoadedArt } from "./textureFilters.ts";

// The manifest ships inside the hashed bundle rather than loading from /art/, so a copy an earlier
// version cached can never be paired with this code.
const MANIFEST = manifestJson as ArtManifest;
const REQUIRED_UI_KEYS = new Set(UI_FRAMES.map(({ art }) => art));

// First scene to run. Loads everything art's manifest lists, makes an animation of every sprite
// tag, looping unless the manifest lists it as played once, then, once the save is read, opens the
// start screen and launches the pause scene beside it, or updates the game where a newer version
// wrote the save.
export class BootScene extends Scene {
  // The startup checks' pending phase, after the measured file load.
  private startupChecks?: ProgressHandle;
  private loaderWatch?: LoaderWatch<string>;
  private readonly preparedUiArt = new Set<string>();
  private readonly startupSignal: AbortSignal | undefined;

  constructor(startupSignal?: AbortSignal) {
    super("boot");
    this.startupSignal = startupSignal;
  }

  // A production build loads game art from shared atlas pages. The HTML UI loads its font
  // faces through DOM readiness. create filters every world texture (textureFilters.ts).
  // The kit's loader watch measures the file load as one the player waits for, by its settled
  // files, which the bar shows through the launch's one value after a first install
  // (launchLoading), and logs and retries failed files; it ends with the scene.
  preload(): void {
    if (this.startupSignal?.aborted) {
      return;
    }
    const watch = watchLoader(
      {
        console,
        progress: launchLoading.boot,
        retryMode: (failure) => (this.requiredFile(failure) ? "manual" : "automatic"),
        timer: window,
      },
      this,
    );
    this.loaderWatch = watch;
    watch.waitFor("boot");
    const cancel = () => {
      this.loaderWatch?.dispose();
      this.startupChecks?.finish();
    };
    this.startupSignal?.addEventListener("abort", cancel, { once: true });
    this.events.once("shutdown", () => this.startupSignal?.removeEventListener("abort", cancel));
    this.load.once("complete", () => {
      if (!this.startupSignal?.aborted) {
        this.startupChecks = beginStartupChecks();
      }
    });
    if (ATLAS !== null) {
      queueAtlasPages(this, ATLAS);
    }
    this.load.setPath(ART_PATH);
    this.cache.json.add(ART_MANIFEST_KEY, MANIFEST);
    for (const { json, key } of MANIFEST.data) {
      const bundled = BUNDLED_ART_DATA[key];
      if (bundled === undefined) {
        this.load.json(key, json);
      } else {
        this.cache.json.add(key, bundled);
      }
    }
    for (const { json, key } of MANIFEST.tilesets) {
      this.load.json(key, json);
    }
    const packedKeys = new Set(ATLAS?.textures.map(({ key }) => key));
    for (const { key, png } of MANIFEST.images) {
      if (!packedKeys.has(key)) {
        this.load.image(key, png);
      }
    }
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
    if (this.startupSignal?.aborted) {
      this.startupChecks?.finish();
      return;
    }
    if (new URLSearchParams(window.location.search).has("stagePreview")) {
      this.prepareArt();
      this.scene.start("zone");
      return;
    }
    this.prepareStartup();
  }

  private prepareArt(): void {
    if (ATLAS !== null) {
      addAtlasArt(this, {
        ...ATLAS,
        textures: ATLAS.textures.filter(({ key }) => !this.preparedUiArt.has(key)),
      });
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
  }

  private prepareUiArt(): void {
    if (ATLAS === null) {
      return;
    }
    const keys = new Set(UI_FRAMES.map(({ art }) => art));
    const textures = ATLAS.textures.filter(({ key }) => keys.has(key));
    for (const key of keys) {
      if (!textures.some((texture) => texture.key === key)) {
        throw new Error(`Missing required UI atlas texture ${key}`);
      }
    }
    for (const page of new Set(textures.map(({ page }) => page))) {
      if (!this.textures.exists(atlasPageKey(page))) {
        throw new Error(`Required UI atlas page ${page} failed to load`);
      }
    }
    for (const texture of textures) {
      if (this.preparedUiArt.has(texture.key)) {
        continue;
      }
      if (this.textures.exists(texture.key)) {
        throw new Error(`Required UI alias ${texture.key} already exists`);
      }
      addAtlasArt(this, { ...ATLAS, textures: [texture] });
      this.preparedUiArt.add(texture.key);
    }
  }

  private requiredFile({ key }: Pick<LoadFailure, "key">): boolean {
    return ATLAS === null
      ? REQUIRED_UI_KEYS.has(key)
      : ATLAS.textures.some(
          (texture) => REQUIRED_UI_KEYS.has(texture.key) && atlasPageKey(texture.page) === key,
        );
  }

  private prepareStartup(): void {
    let live = true;
    let stopReady = () => {};
    let stopAttempt = () => {};
    const attempts = createLoadingAttempts({
      load: async (attempt) => {
        const watch = this.loaderWatch;
        const required = (failure: LoadFailure) => this.requiredFile(failure);
        if (attempt.id > 1 && watch?.failures().some(required)) {
          watch.waitFor("boot");
          await watch.retryFailures(required);
          if (!attempt.isCurrent()) {
            return;
          }
          this.startupChecks = beginStartupChecks();
        }
        if (watch?.failures().some(required)) {
          throw new Error("Required UI files failed to load");
        }
        this.prepareUiArt();
        await prepareDomUi(this);
      },
      onReady: () => {
        stopReady = requiredLoading.wait(() => {
          if (live) {
            void this.enterGame(() => live);
          }
        });
      },
      onState: (state) => {
        if (state.kind === "loading") {
          this.startupChecks = beginStartupChecks();
        } else if (state.kind === "failed") {
          this.startupChecks?.finish();
        }
        requiredLoading.invalidate();
      },
    });

    const cancel = () => {
      live = false;
      stopReady();
      attempts.dispose();
      stopAttempt();
      this.startupChecks?.finish();
    };
    this.startupSignal?.addEventListener("abort", cancel, { once: true });
    this.events.once("shutdown", () => {
      cancel();
      this.startupSignal?.removeEventListener("abort", cancel);
    });
    void probeSaveAge().then((age) => {
      if (!live) {
        return;
      }
      if (age === "newer") {
        const recoveryUi = Promise.resolve()
          .then(() => {
            this.prepareUiArt();
            return prepareDomUi(this, { required: false });
          })
          .catch((error: unknown) => console.warn("The recovery UI failed to load", error));
        this.updateForNewerSave(recoveryUi);
      } else {
        stopAttempt = observeRequiredAttempt(() => attempts.retry(), attempts);
        void attempts.start();
      }
    });
  }

  // Required UI succeeds before this mutation-capable save load or any playable scene entry.
  private async enterGame(live: () => boolean): Promise<void> {
    this.prepareArt();
    const age = await loadProgress();
    if (!live()) {
      return;
    }
    if (age === "newer") {
      this.updateForNewerSave(Promise.resolve());
      return;
    }
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
    this.scene.start(new URLSearchParams(window.location.search).has("zone") ? "zone" : "start");
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
    let live = true;
    const stop = requiredUpdate.subscribe((next) => {
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
        if (live && state === "unavailable" && message === undefined) {
          message = mountSceneView(
            this,
            createMessageCard(document, "connect-card", TEXT.update.connect),
          );
        }
      });
    });
    const cancel = () => {
      live = false;
      stop();
      updating?.finish();
      message?.();
    };
    this.startupSignal?.addEventListener("abort", cancel, { once: true });
    this.events.once("shutdown", () => {
      cancel();
      this.startupSignal?.removeEventListener("abort", cancel);
    });
    requireNewer();
  }
}
