import {
  type AnimationFrame,
  animationKey,
  type AsepriteSheet,
  sheetTags,
  tagMs,
} from "@andornaut/game-kit/art/aseprite";
import { frameSteps, startStepClock, type StepClock } from "@andornaut/game-kit/clock/fixedStep";
import { drawProgressBar } from "@andornaut/game-kit/progress/phaser/drawProgressBar";
import { type Random, randomStream } from "@andornaut/game-kit/random";
import { clampInto, containsPoint } from "@andornaut/game-kit/rect";
import { pageToGame } from "@andornaut/game-kit/view/pagePoint";
import { type GameObjects, Input, Scale, Scene, Scenes, type Tilemaps } from "phaser";

import { ARCHETYPES } from "../data/archetypes";
import { BIRD } from "../data/bird";
import { BOSS_WARNING } from "../data/bossWarning";
import { CAMERA } from "../data/camera";
import { CHARACTERS } from "../data/characters";
import { DASH_TRAIL } from "../data/dashTrail";
import { DEATH } from "../data/death";
import { ZONE_DIALOGUES } from "../data/dialogues";
import { CONTACT_CUE } from "../data/feedback";
import { ZONE_MAP } from "../data/map";
import { SCREEN, TILE } from "../data/screen";
import { SKILLS } from "../data/skills";
import { STAGE_BARKS } from "../data/stageBarks";
import { TEXT } from "../data/text";
import { TOUCH } from "../data/touch";
import type {
  AreaLayout,
  ArtHitbox,
  CharacterState,
  Collision,
  ObjectLayout,
  Point,
  Rect,
  SpriteSilhouettes,
  ZoneLayout,
  ZonePlan,
} from "../data/types";
import { RECIPES, TEST_ZONES } from "../data/zones";
import {
  developmentSkillOverrides,
  invulnerabilityEnabled,
  isDevelopmentSession,
} from "../dev/mode";
import { developmentStep } from "../dev/step";
import { FRAME_TURN } from "../input/frameTurn";
import {
  combineIntents,
  type HeldTouch,
  keyIntent,
  touchIntent,
  touchRoleAt,
} from "../input/intent";
import { isMouseMovementKey, listenMouseMovement } from "../input/mouseMovement";
import { PAUSE_BUTTON } from "../layout/pauseCard";
import { bottomShift, shifted, topShift } from "../layout/playView";
import { SKILL_BUTTON, SKILL_HUD } from "../layout/skillHud";
import { MOVE_HINT, TOUCH_CONTROLS, type TouchControl } from "../layout/touchControls";
import { afterLoadingPaint, beginStageLoading } from "../loading/progress";
import { PROGRESS_RECT, stageProgressStyle } from "../loading/style";
import {
  clientPoint,
  listenPagePresses,
  onPageControl,
  type PagePointerEvent,
  type PagePress,
} from "../platform/input/pagePresses";
import { coverZone, startWakeLock, stopWakeLock } from "../pwa";
import { contactFrameAt, spriteFrameOrigin } from "../rules/bodyContact";
import { deathSupport } from "../rules/death";
import { nodeOf } from "../rules/map";
import { currentScreen } from "../rules/perception";
import { eligibleSkills, skillTuning } from "../rules/skills";
import { createStageBarks } from "../rules/stageBarks";
import { askedStagePreview, type StagePreview, stagePreviewScroll } from "../rules/stagePreview";
import { stageProgress } from "../rules/stageProgress";
import { STEP_MS, STEP_SECONDS } from "../rules/step";
import { zoneLayout } from "../rules/tiles";
import {
  activateBehaviour,
  areaOf,
  enterArea,
  leaveRoom,
  retryZone,
  roomOf,
  startZone,
  stepZone,
  type ZoneBark,
  type ZoneState,
} from "../rules/zone";
import {
  askedAssemblySeed,
  askedRecipe,
  newAssemblySeed,
  nextZoneIndex,
  startZoneIndex,
} from "../rules/zoneChain";
import {
  introductionForRun,
  type ZoneDepartureTarget,
  zoneExitFlow,
  type ZoneStory,
  zoneStoryForStage,
} from "../rules/zoneFlow";
import { zonePlanFor } from "../rules/zonePlans";
import {
  activeSkill,
  activeStageTime,
  beginStageRun,
  beginZoneVisit,
  completeStageRun,
  flushStats,
  recordActiveStageStep,
  retryStageRun,
  saveCompleted,
  savedMap,
  savedSkills,
  saveZoneIntro,
  seenZoneIntros,
  stageRunStats,
  wholeRunStats,
  zoneVisitStats,
} from "../save";
import { wholeRunSummary } from "../save/runSummary";
import { type TouchSetting, touchSettings, touchSettingShown } from "../settings/touchControls";
import { ART_MANIFEST_KEY, artHitboxes, type ArtManifest } from "../view/aseprite";
import { backgroundGroundOffset, backgroundGroundReference } from "../view/backgroundGround";
import { behaviourPose } from "../view/behaviour";
import { BIRD_FRAME, birdFrameAt, type BirdPose, startPose, stepPose } from "../view/bird";
import { characterState, nextQuirkAt } from "../view/character";
import { chunkBackdropSpan, chunkParallax } from "../view/chunkParallax";
import {
  deathFrameIndex,
  deathLabels,
  type DeathPresentation,
  deathPresentationTarget,
  type DeathView,
  startDeathPresentation,
  stepDeathPresentation,
} from "../view/death";
import { doorPhase } from "../view/doorOpen";
import { forceVisualPosition } from "../view/forceVisual";
import { interiorBackdrop } from "../view/interiorBackdrop";
import { moveHintView } from "../view/moveHint";
import {
  type ArtKind,
  artKind,
  artOffset,
  artScrollFactor,
  sceneryParallax,
  worldScenery,
} from "../view/objectArt";
import { type PlayHold, stepAction } from "../view/playHold";
import { scenerySpriteFrame } from "../view/scenerySprite";
import { CONTACT_SILHOUETTES, spriteContacts } from "../view/spriteContacts";
import { loadedTileset, objectTiles, terrainTiles, type Tileset } from "../view/tiles";
import { buttonHeld, centredAt, controlTag, trackPress } from "../view/touchControls";
import { barkOwnerOnscreen, proximityDialogue } from "../view/zoneDialogue";
import { mountBossWarning } from "./bossWarning";
import { paletteColour } from "./cardParts";
import { cancelContactFeedback, playContactFeedback } from "./contactFeedback";
import type { CutsceneData } from "./CutsceneScene";
import { mountDashTrail } from "./dashTrail";
import { frameDeathCamera } from "./deathCamera";
import type { DeathData, DeathOpener } from "./DeathScene";
import { type DialogueData, type DialogueOpener } from "./DialogueScene";
import { modalInput } from "./modalInput";
import { canvasRect, fitCanvasCamera, fitPlayCamera } from "./playCamera";
import type { RoomData } from "./RoomScene";
import { bindZoneBarks } from "./zoneBarks";
import type { ZoneBarkScene } from "./ZoneBarkScene";
import type { ZoneDepartureData } from "./ZoneDepartureScene";
import type { IntroductionOpener, ZoneIntroductionData } from "./ZoneIntroductionScene";

// The zone a map node plays, assembled for seed where it is a recipe.
function zoneAt(seed: number, node: string): ZonePlan {
  const key = nodeOf(ZONE_MAP, node).zone;
  if (key === undefined) {
    throw new Error(`Map node ${node} has no zone to play`);
  }
  return zonePlanFor(seed, key);
}

// What every zone's instances are resolved against.
const CATALOGUE = { archetypes: ARCHETYPES, characters: CHARACTERS };

// The debug chain starts with the opening stage, followed by the test zones.
const CHAIN_LENGTH = 1 + TEST_ZONES.length;

// After a stall, run at most this much time at once rather than lurching ahead.
const MAX_FRAME_MS = 250;

// PLACEHOLDER: flat colours where an area or object has no art: the ground, the terrain, and
// each object by its collision. An area drawn from a tileset shows ink below its terrain.
const BACKGROUND = 0x262b44;
const INK = 0x181425;
const TERRAIN = 0x8b9bb4;
const OBJECT_COLOURS: Readonly<Record<Collision, number>> = {
  hazard: 0xe43b44,
  ledge: 0xc0cbdc,
  none: 0xf6757a,
  solid: 0xe4a672,
  use: 0x63c74d,
};
// Leaving an ended zone fades to black, and where the next zone plays in this scene, back, each
// way this long, with play held still.
const FADE_MS = 250;

const BIRD_SPRITE = "bird";
const MOVE_HINT_SPRITE = "ui-move-hint";
const MOVE_KNOB_SPRITE = "ui-move-knob";
const CONTROL_SPRITES: Readonly<Record<TouchControl, string>> = {
  jump: "ui-touch-jump",
  use: "ui-touch-use",
};
// Back to front: repeated backdrops, placed backdrops, the terrain, objects, her, and the touch
// controls. An area's art is added whenever it is drawn.
const DEPTHS: Readonly<Record<ArtKind | "terrain", number>> = {
  backdrop: -3,
  placeholder: 0,
  "repeated-backdrop": -4,
  sprite: 0,
  terrain: -2,
  tiles: -1,
};
const BIRD_DEPTH = 1;
const OVERLAY_DEPTH = 2;

// Everything drawn for one object, placed at its top-left corner plus offset. A sprite faces the
// way it last moved.
interface ObjectArt {
  disposed?: boolean;
  readonly item: GameObjects.Components.Transform & GameObjects.GameObject;
  readonly offset: Point;
  readonly scenery?: boolean;
  // When its next quirk plays, and the draws that time it.
  readonly quirk?: { at: number; readonly random: Random };
  readonly sprite: GameObjects.Sprite | undefined;
}

// Starts a sprite's tag, unless it already shows it, playing or finished on its last frame.
function show(sprite: GameObjects.Sprite, tag: string): void {
  const key = animationKey(sprite.texture.key, tag);
  if (sprite.anims.currentAnim?.key !== key) {
    sprite.play(key);
  }
}

// What a zone starts with: see ZoneScene.init.
export interface ZoneData {
  readonly backdrop?: boolean;
  readonly node?: string;
  readonly continueVisit?: boolean;
}

// One zone, played with the keyboard or the touch controls.
export class ZoneScene extends Scene implements DeathOpener, DialogueOpener, IntroductionOpener {
  private clock: StepClock = startStepClock;
  private readonly controls = new Map<TouchControl, GameObjects.Sprite>();
  // The move hint's ring and knob.
  private moveHint!: { readonly knob: GameObjects.Sprite; readonly ring: GameObjects.Sprite };
  private bird!: GameObjects.Sprite;
  private dashWind: ReturnType<typeof mountDashTrail> | undefined;
  private bossWarning: ReturnType<typeof mountBossWarning> | undefined;
  private birdPose: BirdPose = startPose;
  private dying: DeathPresentation | undefined;
  private deathView: DeathView | undefined;
  private deathModal = false;
  private deathFraming = false;
  private restoreDeathCamera: (() => void) | undefined;
  private progress!: GameObjects.Graphics;
  private loading = true;
  private zone!: ZoneState;
  private readonly heldKeys = new Set<string>();
  private readonly heldTouches = new Map<number, HeldTouch>();
  private readonly buttonTouches = new Set<number>();
  private landMs = 0;
  private layout!: ZoneLayout;
  private zoneIndex = startZoneIndex(window.location.search, CHAIN_LENGTH);
  // The map node she plays, or undefined when ?zone=<n> chains the zones without the map.
  private mapNode: string | undefined;
  // The recipe ?zone=<key> plays on its own, assembled afresh each time she clears it unless
  // ?assembly=<n> fixes the seed.
  private trial: string | undefined;
  private areaArt!: GameObjects.Graphics;
  // Drawn as the start screen's backdrop rather than played.
  private backdrop = false;
  private preview: StagePreview | undefined;
  // The hit boxes art's sprites declare, by art key.
  private hitboxes: Readonly<Record<string, ArtHitbox>> = {};
  private manifest!: ArtManifest;
  // The area drawn, and a rectangle for each of its objects.
  private areaShown = "";
  private attemptShown = 0;
  // Why play holds still, if it does.
  private hold: PlayHold;
  // The door she used, by its index among the area's objects, while it opens: when Use went down,
  // in ms, and how long its open tag runs (undefined without one). drawObjects leaves its tag
  // alone meanwhile.
  private opening:
    { readonly at: number; readonly index: number; readonly ms?: number } | undefined;
  // Whether a room shows over the paused zone.
  private inRoom = false;
  private dialogueObject: number | undefined;
  private story: ZoneStory | undefined;
  private continueVisit = false;
  private departure: ZoneDepartureTarget | undefined;
  private readonly localSeenIntros = new Set<string>();
  private introductionActive = false;
  private barks: ReturnType<typeof bindZoneBarks> | undefined;
  private scheduledBarks: ReturnType<typeof createStageBarks> | undefined;
  private dialogueAttempt = -1;
  private dialogueArea = "";
  private readonly heardDialogues = new Map<string, Set<number>>();
  private objectArt: ObjectArt[] = [];
  private readonly chunkBackdrops: {
    readonly bounds: Rect;
    readonly item: GameObjects.TileSprite;
    readonly parallax: Point;
    readonly reference?: { readonly scroll: Point; readonly textureTop: number };
  }[] = [];
  private readonly scenerySprites: {
    readonly coverage: { readonly width: number; readonly x: number };
    readonly frame: Rect;
    readonly item: GameObjects.Sprite;
    readonly parallax: Point;
  }[] = [];
  private readonly pulseArt = new Map<number, GameObjects.Sprite>();
  private readonly transientArt = new Map<number, ObjectArt>();
  private terrainMap: Tilemaps.Tilemap | undefined;
  // When each held button's press began.
  private readonly presses = new Map<TouchControl, number>();
  private readonly tags = new Map<string, ReadonlyMap<string, readonly AnimationFrame[]>>();

  constructor() {
    super("zone");
  }

  // data.node: the map node to play; without one, the recipe ?zone=<key> names, or the chain from
  // ?zone=<n>. data.backdrop: the start screen's backdrop instead (holdStill).
  init(data: ZoneData): void {
    const { search } = window.location;
    this.preview = askedStagePreview(
      [
        ...ZONE_MAP.nodes
          .filter((node) => node.kind === "zone" && node.zone !== undefined)
          .map((node) => node.id),
        ...Object.keys(RECIPES),
      ],
      search,
    );
    this.loading = true;
    this.backdrop = data.backdrop === true;
    this.mapNode = data.node;
    this.continueVisit = data.continueVisit === true;
    this.trial = askedRecipe(search, Object.keys(RECIPES));
    // Everything one run of the zone changes starts afresh: the scene object is reused.
    this.objectArt = [];
    this.chunkBackdrops.length = 0;
    this.scenerySprites.length = 0;
    this.transientArt.clear();
    this.pulseArt.clear();
    this.heldKeys.clear();
    this.heldTouches.clear();
    this.buttonTouches.clear();
    this.presses.clear();
    this.hold = undefined;
    this.opening = undefined;
    this.inRoom = false;
    this.dialogueObject = undefined;
    this.departure = undefined;
    this.localSeenIntros.clear();
    this.introductionActive = false;
    this.barks = undefined;
    this.scheduledBarks = undefined;
    this.dialogueAttempt = -1;
    this.dialogueArea = "";
    this.heardDialogues.clear();
    this.clock = startStepClock;
    this.birdPose = startPose;
    this.dashWind = undefined;
    this.bossWarning = undefined;
    this.dying = undefined;
    this.deathView = undefined;
    this.deathModal = false;
    this.deathFraming = false;
  }

  create(): void {
    const renderBackdrops = () => this.renderBackdrops();
    this.events.on(Scenes.Events.PRE_RENDER, renderBackdrops);
    this.events.once("shutdown", () => {
      this.events.off(Scenes.Events.PRE_RENDER, renderBackdrops);
      this.chunkBackdrops.length = 0;
      this.scenerySprites.length = 0;
    });
    if (this.preview || this.backdrop) {
      this.loading = false;
      this.createReady();
      return;
    }
    this.loading = true;
    this.input.enabled = false;
    coverZone("loading", true);
    const operation = beginStageLoading(this.stageKey());
    const cancel = afterLoadingPaint(() => {
      this.createReady();
      this.drawObjects();
      this.drawBird();
      this.drawProgress();
      const ready = () => {
        operation.finish();
        this.loading = false;
        this.clock = startStepClock;
        this.clearControls();
        this.input.enabled = true;
        coverZone("loading", false);
        this.openIntroduction();
      };
      this.game.events.once("postrender", ready);
      this.events.once("shutdown", () => this.game.events.off("postrender", ready));
    });
    this.events.once("shutdown", () => {
      cancel();
      operation.finish();
      coverZone("loading", false);
    });
  }

  private createReady(): void {
    // The main camera shows the zone in the game's view; the controls camera covers the whole
    // canvas for the touch buttons, anchored to its bottom-right corner, and shows nothing else.
    fitPlayCamera(this);
    const controlsCamera = this.cameras.add();
    fitCanvasCamera(this, controlsCamera);
    const offControls = (object: GameObjects.GameObject) => controlsCamera.ignore(object);
    this.events.on(Scenes.Events.ADDED_TO_SCENE, offControls);
    this.events.once("shutdown", () => this.events.off(Scenes.Events.ADDED_TO_SCENE, offControls));
    this.cameras.main.setBackgroundColor(BACKGROUND);
    this.cameras.main.setRoundPixels(true);
    this.areaArt = this.add.graphics();
    this.progress = this.add.graphics().setDepth(OVERLAY_DEPTH);
    this.cameras.main.ignore(this.progress);
    this.progress.cameraFilter &= ~controlsCamera.id;
    this.events.once("shutdown", () => {
      this.scene.stop("zoneIntroduction");
      this.introductionActive = false;
      if (this.dialogueOpen()) {
        this.scene.stop("dialogueChoice");
        this.scene.stop("dialogue");
        this.scene.stop("zoneDeparture");
      }
      this.dialogueObject = undefined;
      coverZone("dialogue", false);
      this.deathFraming = false;
      cancelContactFeedback(this.events);
      this.restoreDeathCamera?.();
      this.restoreDeathCamera = undefined;
      this.scene.stop("death");
      coverZone("death", false);
      if (!this.backdrop && !this.preview) {
        void flushStats();
      }
    });

    this.landMs = tagMs(this.sheet(BIRD_SPRITE), "land");

    this.bossWarning = mountBossWarning(
      BOSS_WARNING,
      (DEPTHS.tiles + DEPTHS.sprite) / 2,
      (name) => paletteColour(this, name),
      this,
    );
    this.dashWind = mountDashTrail(
      DASH_TRAIL,
      BIRD_DEPTH,
      (name) => paletteColour(this, name),
      this,
    );
    this.bird = this.add.sprite(0, 0, BIRD_SPRITE).setOrigin(0).setDepth(BIRD_DEPTH);
    this.manifest = this.cache.json.get(ART_MANIFEST_KEY) as ArtManifest;
    this.hitboxes = artHitboxes(
      (key) => this.textures.getFrame(key),
      this.manifest,
      spriteContacts(
        this.manifest,
        (key) => this.cache.json.get(key) as AsepriteSheet,
        (key) => this.textures.getFrame(key),
        this.cache.json.get(CONTACT_SILHOUETTES) as SpriteSilhouettes | undefined,
      ),
    );
    const node = this.mapNode;
    const seed =
      this.preview?.assemblySeed ?? askedAssemblySeed(window.location.search) ?? newAssemblySeed();
    if (this.preview) {
      const key = this.preview.key;
      const node = ZONE_MAP.nodes.find((node) => node.id === key && node.kind === "zone");
      this.loadPlan(node ? zoneAt(seed, key) : zonePlanFor(seed, key));
      this.freezePreview(this.preview);
      return;
    }
    if (this.backdrop) {
      this.loadPlan(zoneAt(seed, ZONE_MAP.start));
      this.holdStill();
      return;
    }
    // An assembled zone is assembled afresh each time she enters it, unless ?assembly=<n> fixes
    // the seed.
    if (node !== undefined) {
      this.loadPlan(zoneAt(seed, node));
    } else if (this.trial !== undefined) {
      this.loadPlan(zonePlanFor(seed, this.trial));
    } else {
      this.loadZone(this.zoneIndex);
    }

    for (const control of Object.keys(CONTROL_SPRITES) as TouchControl[]) {
      const sprite = this.add
        .sprite(0, 0, CONTROL_SPRITES[control])
        .setOrigin(0)
        .setScrollFactor(0)
        .setDepth(OVERLAY_DEPTH);
      const at = centredAt(TOUCH_CONTROLS[control].centre, sprite.frame);
      this.controls.set(control, sprite.setPosition(at.x, at.y));
      this.cameras.main.ignore(sprite);
      sprite.cameraFilter &= ~controlsCamera.id;
    }
    this.moveHint = {
      knob: this.add.sprite(0, 0, MOVE_KNOB_SPRITE).setOrigin(0),
      ring: this.add.sprite(0, 0, MOVE_HINT_SPRITE).setOrigin(0),
    };
    for (const part of [this.moveHint.ring, this.moveHint.knob]) {
      part.setScrollFactor(0).setDepth(OVERLAY_DEPTH);
      this.cameras.main.ignore(part);
      part.cameraFilter &= ~controlsCamera.id;
    }
    this.drawMoveHint([]);
    this.placeControls();
    this.scale.on(Scale.Events.RESIZE, this.placeControls, this);
    this.events.once("shutdown", () =>
      this.scale.off(Scale.Events.RESIZE, this.placeControls, this),
    );
    this.barks = bindZoneBarks(
      {
        canPresent: () => this.barksCanPresent(),
        ownerVisible: (owner) => this.barkOwnerOnscreen(owner),
      },
      this,
    );
    this.events.once("shutdown", () => {
      this.scheduledBarks = undefined;
    });
    this.watchKeys();
    this.watchMouse();
    this.watchTouches();
    this.events.on("pause", () => {
      void flushStats();
    });
    // Paused under the pause card or a room: keys and time while it was open count for nothing.
    // Back from a room, she stands at its door with nothing held, and the door shows closed.
    this.events.on("resume", () => {
      this.clock = startStepClock;
      this.heldKeys.clear();
      if (this.inRoom) {
        this.inRoom = false;
        this.hold = undefined;
        this.closeDoor(this.zone.door);
        this.zone = leaveRoom(this.zone);
        this.heldTouches.clear();
      }
    });
  }

  private openIntroduction(): void {
    if (this.preview || this.backdrop || this.introductionActive) {
      return;
    }
    const intro = introductionForRun(
      ZONE_MAP,
      this.stageKey(),
      new Set([...this.localSeenIntros, ...seenZoneIntros()]),
      this.story,
    );
    if (!intro?.entry) {
      return;
    }
    this.introductionActive = true;
    this.clearControls();
    this.input.enabled = false;
    this.showTouchControls(touchSettings());
    coverZone("dialogue", true);
    const camera = this.cameras.main;
    this.scene.launch("zoneIntroduction", {
      entry: intro.entry,
      feet: {
        x: this.zone.bird.x + BIRD.width / 2 - camera.scrollX,
        y: this.zone.bird.y + BIRD.height - camera.scrollY,
      },
      scene: intro.intro,
    } satisfies ZoneIntroductionData);
    this.scene.pause();
  }

  introductionHeard(): void {
    if (!this.introductionActive || !this.story) {
      return;
    }
    this.localSeenIntros.add(this.story.zone);
    if (this.mapNode !== undefined) {
      saveZoneIntro(this.story.zone);
    }
  }

  introductionDepartureStarted(): void {
    if (!this.introductionActive) {
      return;
    }
    this.introductionActive = false;
    this.clearControls();
    this.input.enabled = true;
    this.showTouchControls(touchSettings());
    coverZone("dialogue", false);
    this.scene.resume();
  }

  // The start screen's backdrop: zone 1's street as she starts it, without her or the touch
  // buttons, drawn once and paused as soon as it is created, so it never steps, animates or takes
  // input, and isActive("zone") stays false for the pause scene and the frame rate cap.
  private holdStill(): void {
    this.bird.setVisible(false);
    this.drawObjects();
    this.drawBird();
    this.events.once("create", () => this.sys.pause());
  }

  private freezePreview(preview: StagePreview): void {
    if (preview.area && preview.area !== this.zone.area) {
      this.zone = enterArea(
        this.movementTuning(),
        this.layout,
        { area: preview.area, entry: "start" },
        this.zone,
      );
      this.drawArea();
    }
    this.progress.setVisible(false);
    this.input.enabled = false;
    this.drawObjects();
    this.drawBird();
    for (const sprite of [
      this.bird,
      ...this.objectArt.flatMap((art) => (art.sprite ? [art.sprite] : [])),
    ]) {
      const frame = sprite.anims.isPlaying
        ? sprite.anims.currentAnim?.frames[0]?.textureFrame
        : undefined;
      sprite.anims.stop();
      if (frame !== undefined) {
        sprite.setFrame(frame);
      }
    }
    const scroll = stagePreviewScroll(SCREEN, areaOf(this.layout, this.zone.area), preview.scroll);
    this.cameras.main.setScroll(scroll.x, scroll.y);
    const ready = () => {
      this.game.canvas.dataset.stagePreview = preview.key;
      this.game.canvas.dataset.stagePreviewReady = "true";
    };
    this.game.events.once("postrender", ready);
    this.events.once("shutdown", () => this.game.events.off("postrender", ready));
    this.events.once("create", () => this.sys.pause());
  }

  // Puts the touch buttons at their places shifted across with the view and down to the canvas's
  // bottom, into the bar below where the canvas is taller than the game's view.
  private placeControls(): void {
    const shift = bottomShift(this.scale.gameSize);
    for (const [control, sprite] of this.controls) {
      const { centre } = TOUCH_CONTROLS[control];
      const at = shifted(shift, centredAt(centre, sprite.frame));
      sprite.setPosition(at.x, at.y);
    }
    this.drawProgress();
  }

  // Shows or hides the touch controls now as settings has them, for the pause card to show the
  // zone behind it as the settings change. They show only on a touch screen.
  showTouchControls(settings: Readonly<Record<TouchSetting, boolean>>): void {
    const touch = !this.playCovered() && window.matchMedia("(pointer: coarse)").matches;
    const buttons = settings.actionButtons && touch;
    for (const sprite of this.controls.values()) {
      sprite.setVisible(buttons);
    }
    const touches = [...this.heldTouches.values()];
    const hint =
      settings.moveControls &&
      touch &&
      (touches.some(({ role }) => role === "move") ||
        (touches.length === 0 && this.buttonTouches.size === 0));
    this.moveHint.ring.setVisible(hint);
    this.moveHint.knob.setVisible(hint);
  }

  // The move hint rests at the bottom-left when idle, follows an eligible movement touch and
  // stays hidden during button-only presses. A second finger on a button keeps the mover's hint.
  private drawMoveHint(touches: readonly HeldTouch[]): void {
    const { knob, ring } = this.moveHint;
    const shown =
      !this.playCovered() &&
      window.matchMedia("(pointer: coarse)").matches &&
      touchSettingShown("moveControls") &&
      (touches.some(({ role }) => role === "move") ||
        (touches.length === 0 && this.buttonTouches.size === 0));
    const rest = shifted(bottomShift(this.scale.gameSize), MOVE_HINT.centre);
    const view = moveHintView(TOUCH, MOVE_HINT.knobReach, rest, touches);
    show(ring, view.ringTag);
    show(knob, view.knobTag);
    const ringAt = centredAt(view.centre, ring.frame);
    const knobAt = centredAt(view.knob, knob.frame);
    ring.setPosition(ringAt.x, ringAt.y).setVisible(shown);
    knob.setPosition(knobAt.x, knobAt.y).setVisible(shown);
  }

  override update(time: number): void {
    if (this.loading) {
      return;
    }
    if (this.deathFraming) {
      return;
    }
    if (this.dying !== undefined) {
      this.updateDeath(time);
      return;
    }
    const frame = frameSteps({ maxFrameMs: MAX_FRAME_MS, stepMs: STEP_MS }, time, this.clock);
    this.clock = frame.clock;
    let touches = [...this.heldTouches.values()];
    const intent = combineIntents(keyIntent(this.heldKeys), touchIntent(TOUCH, touches));
    if (this.opening && doorPhase(this.opening.ms, time - this.opening.at) === "room") {
      this.openRoom();
    }
    for (let step = 0; step < frame.steps; step++) {
      const action = stepAction(this.hold, this.zone.cleared || this.zone.turnedBack);
      if (action === "hold") {
        break;
      }
      if (action === "leave") {
        this.fadeOut();
        break;
      }
      if (this.openProximityDialogue()) {
        break;
      }
      const beforeZone = this.zone;
      const before = this.zone.bird;
      this.zone = developmentStep(
        invulnerabilityEnabled(),
        stepZone(
          this.movementTuning(),
          this.layout,
          STEP_SECONDS,
          { jumpHeld: intent.jump, move: intent.move, useHeld: intent.use },
          this.zone,
        ),
      );
      if (this.zone.steps !== beforeZone.steps) {
        this.barks?.enqueue(this.zone.barks);
      }
      recordActiveStageStep(this.stageKey(), STEP_SECONDS, beforeZone, this.zone);
      if (this.zone.area !== beforeZone.area) {
        this.clearControls();
        touches = [];
        this.birdPose = startPose;
        this.drawArea();
        this.drawObjects();
        this.drawBird();
        if (this.zone.death !== undefined) {
          this.beginDeath();
        }
        break;
      }
      if (this.zone.death !== undefined) {
        this.beginDeath();
        break;
      }
      this.birdPose = stepPose(this.landMs, STEP_MS, before, this.zone.bird, this.birdPose);
      if (this.zone.door !== undefined) {
        this.openDoor(time, this.zone.door);
        break;
      }
      if (this.barksCanPresent()) {
        this.scheduledBarks?.offer(
          (onStart, line) => this.barks?.offer(onStart, line) ?? false,
          this.progressFraction(),
        );
      }
    }
    if (this.deathFraming) {
      return;
    }
    if (this.dying !== undefined) {
      this.drawDeath();
      return;
    }
    if (this.zone.area !== this.areaShown || this.zone.attempt !== this.attemptShown) {
      this.drawArea();
    }
    this.drawObjects();
    this.drawBird();
    this.drawControls(time, touches);
    this.drawMoveHint(touches);
    this.drawProgress();
  }

  private movementTuning() {
    return skillTuning(SKILLS, activeSkill(), BIRD);
  }

  skillState() {
    if (this.loading || this.zone === undefined) {
      return undefined;
    }
    return {
      bird: this.zone.bird,
      shown:
        !this.playCovered() &&
        !this.inRoom &&
        !this.opening &&
        !this.zone.cleared &&
        !this.zone.turnedBack &&
        (!this.scene.isActive("zoneBark") || (this.scene.get("zoneBark") as ZoneBarkScene).idle()),
      tuning: this.movementTuning(),
    };
  }

  resumeSkillPlay(): void {
    this.clearControls();
    this.clock = startStepClock;
  }

  // Pause and page controls stay inert throughout dialogue, death presentation and its card.
  playCovered(): boolean {
    return this.loading || this.dialogueOpen() || this.zone?.death !== undefined;
  }

  private barkOwnerOnscreen(owner: ZoneBark["owner"]): boolean {
    const camera = this.cameras.main;
    return barkOwnerOnscreen(
      {
        area: this.zone.area,
        attempt: this.zone.attempt,
        view: {
          height: camera.height / camera.zoomY,
          width: camera.width / camera.zoomX,
          x: camera.scrollX,
          y: camera.scrollY,
        },
      },
      (index) => {
        const sprite = this.objectArt[index]?.sprite;
        return sprite
          ? { bounds: sprite.getBounds(), rendered: sprite.willRender(camera) }
          : undefined;
      },
      owner,
    );
  }

  private barksCanPresent(): boolean {
    return (
      !this.preview &&
      !this.backdrop &&
      !this.playCovered() &&
      !this.opening &&
      !this.inRoom &&
      !this.zone.cleared &&
      !this.zone.turnedBack &&
      this.zone.door === undefined &&
      this.scene.isActive() &&
      modalInput(this).accepts()
    );
  }

  private stageKey(): string {
    if (this.mapNode !== undefined) {
      return this.mapNode;
    }
    return this.trial === undefined
      ? this.zoneIndex === 0
        ? ZONE_MAP.start
        : ""
      : (ZONE_MAP.nodes.find(({ zone }) => zone === this.trial)?.id ?? "");
  }

  private progressFraction(): number {
    return stageProgress(BIRD, this.layout, this.zone);
  }

  private drawProgress(): void {
    const at = topShift(this.scale.gameSize);
    this.progress.clear();
    drawProgressBar(
      this.progress,
      stageProgressStyle(this.stageKey()),
      { ...PROGRESS_RECT, ...at },
      this.progressFraction(),
    );
  }

  private beginDeath(): void {
    const death = this.zone.death;
    if (death === undefined || this.deathFraming || this.dying !== undefined) {
      return;
    }
    this.dashWind?.clear();
    cancelContactFeedback(this.events);
    const target = deathPresentationTarget(
      DEATH,
      BIRD,
      (position) => deathSupport(BIRD, this.layout, this.zone, position),
      this.zone.bird.facing,
      death,
    );
    this.deathFraming = true;
    this.deathModal = false;
    this.clearControls();
    this.input.enabled = false;
    this.drawObjects();
    for (const art of [...this.objectArt, ...this.transientArt.values()]) {
      art.sprite?.anims.pause();
    }
    for (const art of this.pulseArt.values()) {
      art.anims.pause();
    }
    this.bird.anims.stop();
    this.showTouchControls(touchSettings());
    coverZone("death", true);
    this.drawProgress();
    void flushStats();
    this.restoreDeathCamera = frameDeathCamera(
      DEATH.cameraPan,
      () => {
        if (!this.deathFraming || this.zone.death !== death) {
          return;
        }
        this.deathFraming = false;
        const camera = this.cameras.main;
        this.deathView = {
          body: BIRD,
          bounds: {
            height: SCREEN.height,
            width: SCREEN.width,
            x: camera.scrollX,
            y: camera.scrollY,
          },
          frame: BIRD_FRAME,
        };
        this.dying = startDeathPresentation(DEATH, this.deathView, this.zone.bird.facing, death);
        this.clock = startStepClock;
        if (death.contact?.contactCue === "red-hazard") {
          playContactFeedback(this, {
            cue: CONTACT_CUE,
            depth: OVERLAY_DEPTH,
            reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
            shake: CAMERA.contactShake,
          });
        }
      },
      this,
      { ...BIRD_FRAME, ...birdFrameAt(BIRD, BIRD_FRAME, { ...this.zone.bird, ...target }) },
    );
  }

  private updateDeath(time: number): void {
    const view = this.deathView;
    if (view === undefined || this.dying === undefined) {
      return;
    }
    const frame = frameSteps({ maxFrameMs: MAX_FRAME_MS, stepMs: STEP_MS }, time, this.clock);
    this.clock = frame.clock;
    for (let step = 0; step < frame.steps; step++) {
      this.dying = stepDeathPresentation(DEATH, view, STEP_SECONDS, this.dying);
    }
    this.drawDeath();
    if (this.dying.phase === "seated" && !this.deathModal) {
      cancelContactFeedback(this.events);
      this.deathModal = true;
      const stage = this.stageKey();
      this.scene.launch("death", {
        activeSeconds: activeStageTime(stage),
        runStats: { ...stageRunStats(stage) },
        stage,
        totals: {
          runSeconds: wholeRunStats().activeSeconds,
          stageSeconds: stageRunStats(stage).runSeconds,
          zoneSeconds: zoneVisitStats(this.story?.zone ?? "").runSeconds,
        },
        ...deathLabels(ZONE_MAP, TEXT.map, String(this.zoneIndex + 1), stage),
        percent: this.progressFraction(),
      } satisfies DeathData);
      stopWakeLock();
      this.scene.pause();
    }
  }

  private drawDeath(): void {
    const pose = this.dying;
    if (pose === undefined) {
      return;
    }
    const frame = this.sheet(BIRD_SPRITE).get("death")?.[deathFrameIndex(pose.phase)]?.frame;
    if (frame === undefined) {
      throw new Error(`Missing bird death frame ${pose.phase}`);
    }
    this.bird.setFrame(frame);
    const at = birdFrameAt(BIRD, this.bird.frame, { ...this.zone.bird, ...pose.position });
    this.bird.setPosition(at.x, at.y).setFlipX(pose.facing < 0);
  }

  // The modal stops before returning here. Reuse the layout and cumulative clock, reset inputs
  // and conversations, and let the core create the next explicit attempt.
  retryDeath(): void {
    this.dashWind?.clear();
    if (this.zone.death === undefined) {
      return;
    }
    this.deathFraming = false;
    cancelContactFeedback(this.events);
    this.restoreDeathCamera?.();
    this.restoreDeathCamera = undefined;
    this.barks?.reset();
    retryStageRun(this.stageKey());
    this.zone = retryZone(this.movementTuning(), this.layout, this.zone);
    this.dying = undefined;
    this.deathView = undefined;
    this.deathModal = false;
    this.heardDialogues.clear();
    this.dialogueAttempt = -1;
    this.dialogueArea = "";
    this.birdPose = startPose;
    this.clearControls();
    this.input.enabled = true;
    coverZone("death", false);
    this.drawArea();
    this.drawObjects();
    this.bird.play(animationKey(BIRD_SPRITE, startPose.tag));
    this.drawBird();
    this.drawProgress();
    this.showTouchControls(touchSettings());
    startWakeLock();
    this.scene.resume();
  }

  leaveDeath(): void {
    if (this.zone.death === undefined) {
      return;
    }
    void flushStats();
    this.deathFraming = false;
    cancelContactFeedback(this.events);
    this.restoreDeathCamera?.();
    this.restoreDeathCamera = undefined;
    coverZone("death", false);
    startWakeLock();
    this.scene.start("start");
  }

  // The pause scene and page input stay inert during the conversation, including its launch.
  dialogueOpen(): boolean {
    return (
      this.introductionActive || this.dialogueObject !== undefined || this.departure !== undefined
    );
  }

  private clearControls(): void {
    this.heldKeys.clear();
    this.heldTouches.clear();
    this.presses.clear();
    this.clock = startStepClock;
  }

  private openProximityDialogue(): boolean {
    if (this.dialogueOpen()) {
      return true;
    }
    if (this.zone.attempt !== this.dialogueAttempt) {
      this.heardDialogues.clear();
      this.dialogueAttempt = this.zone.attempt;
    }
    let heard = this.heardDialogues.get(this.zone.area);
    if (!heard) {
      heard = new Set();
      this.heardDialogues.set(this.zone.area, heard);
    }
    if (this.zone.area !== this.dialogueArea) {
      const intro = this.story;
      if (
        intro &&
        (this.localSeenIntros.has(intro.zone) || seenZoneIntros().includes(intro.zone))
      ) {
        areaOf(this.layout, this.zone.area).objects.forEach((object, index) => {
          if (object.scene === intro.intro) {
            heard.add(index);
          }
        });
      }
      for (const index of heard) {
        this.zone = activateBehaviour(index, this.zone);
      }
      this.dialogueArea = this.zone.area;
    }
    const area = areaOf(this.layout, this.zone.area);
    const index = proximityDialogue(area.objects, this.zone.objects, heard, {
      height: BIRD.height,
      width: BIRD.width,
      x: this.zone.bird.x,
      y: this.zone.bird.y,
    });
    const scene = index === undefined ? undefined : area.objects[index]?.scene;
    if (index === undefined || scene === undefined) {
      return false;
    }
    this.dialogueObject = index;
    this.clearControls();
    this.input.enabled = false;
    this.showTouchControls(touchSettings());
    coverZone("dialogue", true);
    this.scene.launch("dialogue", {
      linear: scene === this.story?.intro,
      scene,
    } satisfies DialogueData);
    this.scene.pause();
    return true;
  }

  // The dialogue stops before returning control; introduced actors activate afterward.
  dialogueClosed(): void {
    if (this.departure) {
      const target = this.departure;
      this.departure = undefined;
      coverZone("dialogue", false);
      if (target.kind === "map") {
        this.scene.start("map", { travelTo: target.travelTo });
      } else {
        this.scene.start("celebration");
      }
      return;
    }
    const index = this.dialogueObject;
    if (index === undefined) {
      return;
    }
    const object = areaOf(this.layout, this.zone.area).objects[index];
    if (this.story && object?.scene === this.story.intro) {
      this.localSeenIntros.add(this.story.zone);
      if (this.mapNode !== undefined) {
        saveZoneIntro(this.story.zone);
      }
      areaOf(this.layout, this.zone.area).objects.forEach((actor, actorIndex) => {
        if (actor.scene === this.story?.intro) {
          this.heardDialogues.get(this.zone.area)?.add(actorIndex);
          this.zone = activateBehaviour(actorIndex, this.zone);
        }
      });
    }
    this.heardDialogues.get(this.zone.area)?.add(index);
    this.zone = activateBehaviour(index, this.zone);
    this.dialogueObject = undefined;
    this.clearControls();
    this.input.enabled = true;
    this.showTouchControls(touchSettings());
    coverZone("dialogue", false);
    this.scene.resume();
  }

  // Fades out of the ended zone, play held still, then leaves it.
  private fadeOut(): void {
    this.hold = "fade";
    const camera = this.cameras.main;
    camera.fadeOut(FADE_MS, 0, 0, 0);
    camera.once("camerafadeoutcomplete", () => this.leave());
  }

  // Plays the open tag of the door she used, where its art has one, play held still; the room
  // shows once it has run (update), or at once without one.
  private openDoor(nowMs: number, index: number): void {
    this.hold = "door";
    const sprite = this.objectArt[index]?.sprite;
    const tag = areaOf(this.layout, this.zone.area).objects[index]?.animations.open;
    const sheet = sprite && this.sheet(sprite.texture.key);
    const ms = tag !== undefined && sheet?.has(tag) ? tagMs(sheet, tag) : undefined;
    this.opening = { at: nowMs, index, ...(ms !== undefined && { ms }) };
    if (sprite && tag !== undefined && ms !== undefined) {
      sprite.play(animationKey(sprite.texture.key, tag));
    }
    if (doorPhase(ms, 0) === "room") {
      this.openRoom();
    }
  }

  // Shows a door's closed look again, its idle tag or its sheet's first, after its open tag.
  private closeDoor(index: number | undefined): void {
    const sprite = index === undefined ? undefined : this.objectArt[index]?.sprite;
    const object =
      index === undefined ? undefined : areaOf(this.layout, this.zone.area).objects[index];
    if (!sprite || !object) {
      return;
    }
    const tag = object.animations.idle ?? [...this.sheet(object.art).keys()][0];
    if (tag !== undefined) {
      show(sprite, tag);
    }
  }

  // Shows the room behind the door she used, the zone paused under it until she leaves.
  private openRoom(): void {
    this.dashWind?.clear();
    const room = roomOf(this.layout, this.zone);
    this.opening = undefined;
    if (room === undefined) {
      this.hold = undefined;
      return;
    }
    this.inRoom = true;
    this.scene.launch("room", { room } satisfies RoomData);
    this.scene.pause();
  }

  // Save a cleared stage before routing to its continuation. Turning back preserves progress;
  // debug and trial runs keep their existing replay route.
  private leave(): void {
    const { turnedBack } = this.zone;
    if (this.mapNode !== undefined && !isDevelopmentSession()) {
      const story = this.story;
      if (!story) {
        throw new Error(`Missing zone story for ${this.mapNode}`);
      }
      const completedBefore = new Set(savedMap().completed);
      const flow = zoneExitFlow(ZONE_MAP, story, completedBefore, this.mapNode, turnedBack);
      const runStats = {
        ...(turnedBack ? stageRunStats(this.mapNode) : completeStageRun(this.mapNode)),
      };
      const zoneStats = { ...zoneVisitStats(story.zone) };
      if (!turnedBack) {
        saveCompleted(this.mapNode);
      }
      const wholeRun = wholeRunSummary(
        ZONE_MAP.destinations.flatMap(({ stages }) => stages),
        savedMap().completed,
        wholeRunStats(),
      );
      this.clearControls();
      if (flow.kind === "next-stage") {
        this.scene.start("cutscene", {
          clearedStage: this.mapNode,
          percent: 1,
          runStats,
          stage: flow.stage,
          wholeRun,
          zoneStats,
        } satisfies CutsceneData);
      } else {
        this.departure = flow.target;
        this.input.enabled = false;
        coverZone("dialogue", true);
        this.showTouchControls(touchSettings());
        this.scene.launch("zoneDeparture", {
          cleared: !turnedBack,
          clearedStage: this.mapNode,
          percent: turnedBack ? this.progressFraction() : 1,
          runStats,
          stage: this.mapNode,
          wholeRun,
          zoneStats,
        } satisfies ZoneDepartureData);
        this.scene.pause();
      }
      return;
    }
    const trial =
      this.trial ??
      (isDevelopmentSession()
        ? ZONE_MAP.nodes.find((node) => node.id === this.mapNode && node.kind === "zone")?.zone
        : undefined);
    if (trial !== undefined) {
      const seed = askedAssemblySeed(window.location.search) ?? newAssemblySeed();
      this.loadPlan(zonePlanFor(seed, trial));
    } else {
      this.loadZone(turnedBack ? this.zoneIndex : nextZoneIndex(this.zoneIndex, CHAIN_LENGTH));
    }
    this.drawObjects();
    this.drawBird();
    const camera = this.cameras.main;
    camera.fadeIn(FADE_MS, 0, 0, 0);
    camera.once("camerafadeincomplete", () => {
      this.hold = undefined;
      this.openIntroduction();
    });
  }

  // Starts the zone at index from its start. Each load draws a fresh seed, so the random
  // motion differs from one play to the next; ?seed=<n> fixes it.
  private loadZone(index: number): void {
    const plan =
      index === 0
        ? zoneAt(askedAssemblySeed(window.location.search) ?? newAssemblySeed(), ZONE_MAP.start)
        : TEST_ZONES[index - 1];
    if (!plan) {
      throw new Error(`No zone ${index + 1}`);
    }
    this.zoneIndex = index;
    this.loadPlan(plan);
  }

  private loadPlan(plan: ZonePlan): void {
    this.barks?.reset();
    this.scheduledBarks =
      this.preview || this.backdrop ? undefined : createStageBarks(STAGE_BARKS, this.stageKey());
    this.heardDialogues.clear();
    this.dialogueAttempt = -1;
    this.dialogueArea = "";
    // PLACEHOLDER: carried choices set no flags yet.
    const tilesets = Object.fromEntries(
      this.manifest.tilesets.map(({ key }) => [key, this.cache.json.get(key) as Tileset]),
    );
    this.layout = zoneLayout(TILE, BIRD_FRAME, CATALOGUE, this.hitboxes, tilesets, new Set(), plan);
    const asked = Number(new URLSearchParams(window.location.search).get("seed"));
    const seed =
      this.preview?.motionSeed ??
      (Number.isInteger(asked) && asked > 0 ? asked : Math.floor(Math.random() * 2 ** 31));
    this.zone = startZone(this.movementTuning(), this.layout, seed);
    this.story =
      this.preview || this.backdrop
        ? undefined
        : zoneStoryForStage(ZONE_MAP, ZONE_DIALOGUES, this.stageKey());
    if (!this.preview && !this.backdrop) {
      if (this.story && !this.continueVisit) {
        beginZoneVisit(this.story.zone);
      }
      beginStageRun(this.stageKey());
    }
    this.drawArea();
  }

  // Draws the area she is in, with the camera kept inside it: its terrain from its tileset, or
  // flat where it has none, and each object's art.
  private drawArea(): void {
    this.bossWarning?.clear();
    const area = areaOf(this.layout, this.zone.area);
    this.areaShown = this.zone.area;
    this.attemptShown = this.zone.attempt;
    this.cameras.main.setBounds(0, 0, area.width, area.height);
    // A tileset art does not have yet draws flat, like an area without one.
    const tileset = loadedTileset(
      TILE,
      (key) => this.cache.json.get(key) as Tileset | undefined,
      area.tileset,
    );
    this.cameras.main.setBackgroundColor(tileset ? INK : BACKGROUND);
    const flat = this.areaArt.clear().setDepth(DEPTHS.terrain);
    this.terrainMap?.destroy();
    this.terrainMap = undefined;
    if (area.tileset && tileset) {
      this.terrainMap = this.drawTerrain(area.tileset, tileset, area);
    } else {
      flat.fillStyle(TERRAIN);
      for (const rect of area.solids) {
        flat.fillRect(rect.x, rect.y, rect.width, rect.height);
      }
    }
    this.chunkBackdrops.length = 0;
    this.scenerySprites.length = 0;
    for (const art of this.objectArt) {
      if (!art.disposed) {
        art.item.destroy();
      }
    }
    for (const art of this.transientArt.values()) {
      art.item.destroy();
    }
    this.transientArt.clear();
    for (const art of this.pulseArt.values()) {
      art.destroy();
    }
    this.pulseArt.clear();
    this.objectArt = area.objects.map((object, index) => {
      const key = object.tileset === null ? undefined : (object.tileset ?? area.tileset);
      const source = loadedTileset(
        TILE,
        (name) => this.cache.json.get(name) as Tileset | undefined,
        key,
      );
      return this.drawObject(key, source, object, index);
    });
  }

  private drawTerrain(key: string, tileset: Tileset, area: AreaLayout): Tilemaps.Tilemap {
    const map = this.make.tilemap({
      height: area.height / TILE,
      tileHeight: TILE,
      tileWidth: TILE,
      width: area.width / TILE,
    });
    const sheet = map.addTilesetImage(key, key, TILE, TILE, 0, 0);
    const layer = sheet && map.createBlankLayer("terrain", sheet, 0, 0);
    if (!layer) {
      throw new Error(`No tilemap layer for ${key}`);
    }
    layer.setDepth(DEPTHS.terrain);
    for (const { col, index, row } of terrainTiles(tileset, map.width, map.height, area.terrain)) {
      layer.putTileAt(index, col, row);
    }
    return map;
  }

  private drawObject(
    key: string | undefined,
    tileset: Tileset | undefined,
    object: ObjectLayout,
    index: number,
  ): ObjectArt {
    const kind = artKind(this.manifest, tileset, object.art);
    const scenery = kind === "sprite" ? sceneryParallax(object) : undefined;
    const world = kind === "sprite" && worldScenery(object);
    const parallax = scenery ?? artScrollFactor(kind, object.parallax);
    const rect = { height: object.height, width: object.width };
    if (object.backdropPlane === "interior" && kind !== "repeated-backdrop") {
      throw new Error(`Interior backdrop requires repeated art: ${object.art}`);
    }
    switch (kind) {
      case "tiles": {
        const images = objectTiles(
          tileset as Tileset,
          object.art,
          rect.width / TILE,
          rect.height / TILE,
        ).map(({ col, index, row }) =>
          this.add.image(col * TILE, row * TILE, key as string, index).setOrigin(0),
        );
        const item = this.add.container(0, 0, images).setDepth(DEPTHS.tiles);
        return { item, offset: { x: 0, y: 0 }, sprite: undefined };
      }
      case "backdrop": {
        const item = this.add
          .image(0, 0, object.art)
          .setOrigin(0)
          .setScrollFactor(parallax.x, parallax.y)
          .setDepth(DEPTHS.backdrop);
        return { item, offset: artOffset(kind, rect, item), sprite: undefined };
      }
      case "repeated-backdrop": {
        if (object.backdropPlane === "interior") {
          if (!object.groundAnchor) {
            throw new Error("Interior backdrop requires a ground anchor");
          }
          const backdrop = this.manifest.backdrops.find(({ key }) => key === object.art);
          if (!backdrop) {
            throw new Error(`Missing interior backdrop metadata: ${object.art}`);
          }
          const reference = {
            scroll: backgroundGroundReference(
              { area: areaOf(this.layout, this.zone.area), camera: CAMERA, screen: SCREEN },
              object.groundAnchor,
            ).scroll,
            textureTop: backdrop.y - backdrop.height,
          };
          const item = this.add
            .tileSprite(object.origin.x, object.origin.y, rect.width, rect.height, object.art)
            .setOrigin(0)
            .setScrollFactor(1, 1)
            .setDepth((DEPTHS["repeated-backdrop"] + DEPTHS.backdrop) / 2);
          this.chunkBackdrops.push({
            bounds: { ...object.origin, ...rect },
            item,
            parallax,
            reference,
          });
          return { item, offset: { x: 0, y: 0 }, sprite: undefined };
        }
        const height = this.textures.getFrame(object.art).height;
        const span = chunkBackdropSpan(areaOf(this.layout, this.zone.area), object);
        const offset = artOffset(kind, rect, { height, width: rect.width });
        const item = this.add
          .tileSprite(0, 0, rect.width, height, object.art)
          .setOrigin(0)
          .setScrollFactor(span ? 1 : parallax.x, span ? 1 : parallax.y)
          .setDepth(DEPTHS["repeated-backdrop"]);
        if (span) {
          this.chunkBackdrops.push({
            bounds: {
              height,
              width: span.width,
              x: span.x,
              y:
                object.origin.y +
                offset.y +
                backgroundGroundOffset(
                  { area: areaOf(this.layout, this.zone.area), camera: CAMERA, screen: SCREEN },
                  object,
                ),
            },
            item,
            parallax,
          });
        }
        return { item, offset, sprite: undefined };
      }
      case "sprite": {
        const sprite = this.add
          .sprite(0, 0, object.art)
          .setOrigin(0)
          .setDepth(scenery || world ? DEPTHS.backdrop : DEPTHS.sprite);
        if (world) {
          sprite.setScrollFactor(1, 1);
          if (object.motion.playback === "once-visible") {
            sprite.setVisible(this.zone.sceneryPlayback?.[index]?.status === "active");
          }
        }
        const tag = object.animations.idle ?? [...this.sheet(object.art).keys()][0];
        if (tag !== undefined) {
          show(sprite, tag);
        }
        const offset = artOffset(kind, rect, sprite.frame);
        if (scenery) {
          const area = areaOf(this.layout, this.zone.area);
          const coverage = area.chunks.find(
            ({ width, x }) => object.origin.x >= x && object.origin.x < x + width,
          ) ?? { width: area.width, x: 0 };
          sprite.setScrollFactor(1, 1);
          this.scenerySprites.push({
            coverage,
            frame: {
              height: sprite.height,
              width: sprite.width,
              x: object.origin.x + offset.x,
              y: object.origin.y + offset.y,
            },
            item: sprite,
            parallax: scenery,
          });
        }
        const [quirk] = object.quirks;
        const random = randomStream(
          this.zone.seed + this.zone.attempt,
          `${this.zone.area}:${index}:quirk`,
        );
        return {
          item: sprite,
          offset,
          ...(scenery && { scenery: true }),
          ...(quirk && { quirk: { at: nextQuirkAt(random, quirk, 0), random } }),
          sprite,
        };
      }
      default: {
        const item = this.add
          .rectangle(0, 0, rect.width, rect.height, OBJECT_COLOURS[object.collision])
          .setOrigin(0)
          .setDepth(DEPTHS.placeholder);
        return { item, offset: { x: 0, y: 0 }, sprite: undefined };
      }
    }
  }

  // Camera changes also reach paused previews and death captures before their next render.
  private renderBackdrops(): void {
    const camera = this.cameras.main;
    const scroll = { x: camera.scrollX, y: camera.scrollY };
    for (const { bounds, item, parallax, reference } of this.chunkBackdrops) {
      if (reference) {
        const { position, textureX, textureY } = interiorBackdrop(
          { parallax, reference: reference.scroll, scroll, textureTop: reference.textureTop },
          bounds,
        );
        item.setPosition(position.x, position.y).setTilePosition(textureX, textureY);
      } else {
        const { position, textureX } = chunkParallax({ parallax, scroll }, bounds);
        item.setPosition(position.x, position.y).setTilePosition(textureX, 0);
      }
    }
    for (const { coverage, frame, item, parallax } of this.scenerySprites) {
      const { crop, position, visible } = scenerySpriteFrame({ coverage, parallax, scroll }, frame);
      item.setPosition(position.x, position.y).setVisible(visible);
      if (visible) {
        item.setCrop(crop.x, crop.y, crop.width, crop.height);
      }
    }
  }

  // Each object where the rules put it, in whole pixels. A character's sprite faces the way it
  // moved and plays the tag for its state, and an idle one now and then plays a quirk.
  private drawObjects(): void {
    this.bossWarning?.clear();
    const area = areaOf(this.layout, this.zone.area);
    const { bird } = this.zone;
    const hers = { x: bird.x + BIRD.width / 2, y: bird.y + BIRD.height / 2 };
    this.zone.objects.forEach((at, index) => {
      const art = this.objectArt[index];
      const object = area.objects[index];
      if (!art || !object) {
        return;
      }
      if (object.motion.playback === "once-visible") {
        const status = this.zone.sceneryPlayback?.[index]?.status ?? "waiting";
        if (status === "completed") {
          if (!art.disposed) {
            art.item.destroy();
            art.disposed = true;
          }
          return;
        }
        art.sprite?.setVisible(status === "active");
      }

      const x = Math.round(at.x + art.offset.x);
      const y = Math.round(at.y + art.offset.y);
      const moved = !art.scenery && (x !== art.item.x || y !== art.item.y);
      const behaviour = this.zone.behaviours[index];
      if (behaviour) {
        if (art.sprite) {
          const pose = behaviourPose(object, behaviour);
          art.sprite.setFlipX(pose.flipX);
          if (object.contact) {
            if (!behaviour.animationTag) {
              throw new Error(`Missing rendered silhouette pose for ${object.art}`);
            }
            art.sprite.anims.stop();
            art.sprite.setFrame(
              contactFrameAt(
                object.contact,
                behaviour.animationTag,
                behaviour.animationSeconds ?? 0,
              ).frame,
            );
          } else if (pose.animation !== undefined) {
            show(art.sprite, pose.animation);
          }
        }
      } else if (art.sprite && index !== this.opening?.index) {
        if (!art.scenery && x !== art.item.x) {
          art.sprite.setFlipX(x < art.item.x);
        }
        const mine = { x: at.x + object.width / 2, y: at.y + object.height / 2 };
        this.animate(art, object, characterState(object, moved, mine, hers));
      }
      const position = object.contact
        ? spriteFrameOrigin(object.contact.frame, object, at)
        : { x, y };
      art.item.setPosition(position.x, position.y);
      if (art.sprite) {
        this.bossWarning?.draw(behaviour, art.sprite);
      }
    });
    this.drawTransients();
    this.drawPulses();
  }

  private drawPulses(): void {
    const alive = new Set(this.zone.pulses.map((pulse) => pulse.id));
    for (const [id, sprite] of this.pulseArt) {
      if (!alive.has(id)) {
        sprite.destroy();
        this.pulseArt.delete(id);
      }
    }
    for (const pulse of this.zone.pulses) {
      const visual = pulse.visual;
      if (!visual) {
        continue;
      }
      let sprite = this.pulseArt.get(pulse.id);
      if (!sprite) {
        sprite = this.add.sprite(0, 0, visual.art).setOrigin(0).setDepth(DEPTHS.sprite);
        this.pulseArt.set(pulse.id, sprite);
      }
      const actor = this.textures.getFrame(visual.actor.art);
      const at = forceVisualPosition(
        { height: actor.realHeight, width: actor.realWidth },
        visual.actor,
        { height: sprite.frame.realHeight, width: sprite.frame.realWidth },
        visual.offset,
        pulse.facing,
        visual.at,
      );
      sprite.setFlipX(pulse.facing === -1).setPosition(Math.round(at.x), Math.round(at.y));
      show(sprite, visual.animation);
    }
  }

  private drawTransients(): void {
    const alive = new Set(this.zone.transients.map((entity) => entity.id));
    for (const [id, art] of this.transientArt) {
      if (!alive.has(id)) {
        art.item.destroy();
        this.transientArt.delete(id);
      }
    }
    for (const entity of this.zone.transients) {
      let art = this.transientArt.get(entity.id);
      if (!art) {
        art = this.drawObject(undefined, undefined, entity.object, entity.id);
        this.transientArt.set(entity.id, art);
      }
      art.item.setPosition(
        Math.round(entity.at.x + art.offset.x),
        Math.round(entity.at.y + art.offset.y),
      );
      const tag =
        entity.age < entity.armSeconds ? entity.armingAnimation : entity.object.animations.idle;
      if (art.sprite && tag !== undefined) {
        show(art.sprite, tag);
      }
    }
  }

  // Plays the tag for a character's state, or while it idles, its quirks when they come due, each
  // timed by the attempt's random draws so a restart rolls them afresh.
  private animate(art: ObjectArt, object: ObjectLayout, state: CharacterState): void {
    const sprite = art.sprite as GameObjects.Sprite;
    const quirk = object.quirks[0];
    const playingQuirk =
      quirk !== undefined &&
      sprite.anims.isPlaying &&
      sprite.anims.currentAnim?.key === animationKey(object.art, quirk.tag);
    if (state === "idle" && quirk && art.quirk) {
      if (this.zone.seconds >= art.quirk.at) {
        sprite.play(animationKey(object.art, quirk.tag));
        art.quirk.at = nextQuirkAt(art.quirk.random, quirk, this.zone.seconds);
        return;
      }
      if (playingQuirk) {
        return;
      }
    }
    const tag = object.animations[state];
    if (tag !== undefined) {
      show(sprite, tag);
    }
  }

  private sheet(key: string): ReadonlyMap<string, readonly AnimationFrame[]> {
    let tags = this.tags.get(key);
    if (!tags) {
      tags = sheetTags(this.cache.json.get(key) as AsepriteSheet);
      this.tags.set(key, tags);
    }
    return tags;
  }

  private drawBird(): void {
    const { bird } = this.zone;
    const { tag } = this.birdPose;
    show(this.bird, tag);
    const at = birdFrameAt(BIRD, this.bird.frame, bird);
    this.bird.setPosition(at.x, at.y).setFlipX(bird.facing < 0);
    if (
      !this.playCovered() &&
      !this.inRoom &&
      !this.opening &&
      this.bird.visible &&
      modalInput(this).accepts()
    ) {
      this.dashWind?.draw(
        this.movementTuning().dash?.durationSeconds ?? 0,
        { ...BIRD_FRAME, ...at },
        bird.dash,
      );
    } else {
      this.dashWind?.clear();
    }
    const scroll = currentScreen(BIRD, areaOf(this.layout, this.zone.area), bird);
    this.cameras.main.setScroll(scroll.x, scroll.y);
  }

  private watchMouse(): void {
    const canvas = this.game.canvas;
    const stopListening = listenMouseMovement(
      (event) => {
        if (
          event.target !== canvas ||
          onPageControl(event.target) ||
          !modalInput(this).accepts() ||
          !this.scene.isActive() ||
          this.playCovered()
        ) {
          return false;
        }
        const point = pageToGame(
          FRAME_TURN.turn(),
          canvas.getBoundingClientRect(),
          this.scale.gameSize,
          { x: event.clientX, y: event.clientY },
        );
        const top = shifted(topShift(this.scale.gameSize), point, -1);
        if (
          containsPoint(PAUSE_BUTTON.hit, top.x, top.y) ||
          (this.skillState()?.shown &&
            eligibleSkills(developmentSkillOverrides(), savedSkills()).some((key) =>
              containsPoint(
                { ...SKILL_HUD[key], height: SKILL_BUTTON.target, width: SKILL_BUTTON.target },
                top.x,
                top.y,
              ),
            ))
        ) {
          return false;
        }
        const role = touchRoleAt(shifted(bottomShift(this.scale.gameSize), point, -1));
        return role === "move" || !this.controls.get(role)?.visible;
      },
      window,
      this.heldKeys,
    );
    const suppressMenu = (event: Event) => event.preventDefault();
    canvas.addEventListener("contextmenu", suppressMenu);
    this.events.once("shutdown", () => {
      stopListening();
      canvas.removeEventListener("contextmenu", suppressMenu);
    });
  }

  private watchKeys(): void {
    modalInput(this).subscribe(() => {
      this.dashWind?.clear();
      this.heldKeys.clear();
      this.heldTouches.clear();
      this.presses.clear();
    });
    const keyboard = this.input.keyboard;
    if (!keyboard) {
      return;
    }
    // Arrow keys and Space would otherwise scroll the page.
    keyboard.addCapture([
      Input.Keyboard.KeyCodes.LEFT,
      Input.Keyboard.KeyCodes.RIGHT,
      Input.Keyboard.KeyCodes.UP,
      Input.Keyboard.KeyCodes.SPACE,
    ]);
    // A key held from before the zone resumed, under the pause card or a room, counts only once
    // pressed again: its repeats never press it.
    keyboard.on("keydown", (event: KeyboardEvent) => {
      if (
        modalInput(this).accepts(event) &&
        !isMouseMovementKey(event.code) &&
        !event.repeat &&
        !this.playCovered() &&
        this.scene.isActive()
      ) {
        this.heldKeys.add(event.code);
      }
    });
    keyboard.on("keyup", (event: KeyboardEvent) => {
      if (!isMouseMovementKey(event.code)) {
        this.heldKeys.delete(event.code);
      }
    });
    // A key released while the page is hidden never sends keyup.
    this.game.events.on("blur", () => this.heldKeys.clear());
  }

  // A touch takes the role it starts with and keeps it, wherever it moves, until it lifts. A new
  // touch goes last in heldTouches, so the latest move touch is the last. Touches anywhere on the
  // page count, the letterbox bars and safe-area margins beside the canvas included, except on
  // the nav bar or a link or button, on visible Pause or skill targets, or while a modal covers play. A
  // touch's role is read where it starts on the game's nearest edge pixel (clampInto), and a move
  // touch's travel unclamped (pageToGame), so a drag within the bars still moves her. Both
  // read through the page frame's turn (FRAME_TURN). Only a touch on the canvas can be on the
  // pause button: one in the bar beside it lands on the game's edge, inside the button's hit
  // area, and moves her.
  private watchTouches(): void {
    const unclamped = (event: PagePointerEvent) =>
      pageToGame(
        FRAME_TURN.turn(),
        this.game.canvas.getBoundingClientRect(),
        this.scale.gameSize,
        clientPoint(event),
      );
    const onGame = (event: PagePointerEvent) => clampInto(canvasRect(this), unclamped(event));
    // The touch buttons sit shifted with the view and to the canvas's bottom (placeControls), and
    // the pause button with the view.
    const roleAt = (point: Point) =>
      touchRoleAt(shifted(bottomShift(this.scale.gameSize), point, -1));
    const accepts = (event: PagePointerEvent) => {
      if (
        !modalInput(this).accepts() ||
        event.pointerType !== "touch" ||
        onPageControl(event.target) ||
        !this.scene.isActive() ||
        this.playCovered()
      ) {
        return false;
      }
      const point = shifted(topShift(this.scale.gameSize), onGame(event), -1);
      if (event.target !== this.game.canvas) {
        return true;
      }
      const skill =
        this.skillState()?.shown &&
        eligibleSkills(developmentSkillOverrides(), savedSkills()).some((key) =>
          containsPoint(
            { ...SKILL_HUD[key], height: SKILL_BUTTON.target, width: SKILL_BUTTON.target },
            point.x,
            point.y,
          ),
        );
      return !containsPoint(PAUSE_BUTTON.hit, point.x, point.y) && !skill;
    };
    const release = ({ pointerId }: PagePress) => {
      this.heldTouches.delete(pointerId);
      this.buttonTouches.delete(pointerId);
    };
    const stopListening = listenPagePresses(
      (event) => event.pointerType === "touch",
      {
        cancel: release,
        down: ({ pointerId }, event) => {
          if (!accepts(event)) {
            this.buttonTouches.add(pointerId);
            return;
          }
          const { x, y } = unclamped(event);
          const role = roleAt(onGame(event));
          this.heldTouches.set(pointerId, { role, startX: x, startY: y, x });
        },
        move: ({ pointerId }, event) => {
          const touch = this.heldTouches.get(pointerId);
          if (touch) {
            this.heldTouches.set(pointerId, { ...touch, x: unclamped(event).x });
          }
        },
        up: release,
      },
      window,
    );
    this.events.once("shutdown", () => {
      stopListening();
      this.heldTouches.clear();
      this.buttonTouches.clear();
    });
  }

  // The buttons show only on a touch screen, with the Action buttons setting on. A pressed
  // button plays its press tag, then holds until release, its label white until then. Nothing
  // marks where a move touch started.
  private drawControls(nowMs: number, touches: readonly HeldTouch[]): void {
    const shown =
      !this.playCovered() &&
      window.matchMedia("(pointer: coarse)").matches &&
      touchSettingShown("actionButtons");
    for (const [control, sprite] of this.controls) {
      sprite.setVisible(shown);
      const since = trackPress(nowMs, buttonHeld(control, touches), this.presses.get(control));
      if (since === undefined) {
        this.presses.delete(control);
      } else {
        this.presses.set(control, since);
      }
      const tag = controlTag(this.sheet(sprite.texture.key), nowMs, since);
      show(sprite, tag);
    }
  }
}
