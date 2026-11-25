import { type AnimationFrame, animationKey } from "@andornaut/game-kit/runtime/art/aseprite";
import { type Random, randomStream } from "@andornaut/game-kit/runtime/random";
import type { GameObjects, Scene } from "phaser";

import { type ArtManifest } from "../assets/index.ts";
import { contactFrameAt, spriteFrameOrigin } from "../core/index.ts";
import { BIRD } from "../data/bird.ts";
import { CAMERA } from "../data/camera.ts";
import { SCREEN, TILE } from "../data/screen.ts";
import type {
  AreaLayout,
  CharacterState,
  Collision,
  ObjectLayout,
  Point,
  Rect,
  SupportPhase,
  ZoneLayout,
} from "../data/types/index.ts";
import {
  type ArtKind,
  artKind,
  artOffset,
  artScrollFactor,
  backdropBottomRect,
  backgroundGroundOffset,
  backgroundGroundReference,
  behaviourPose,
  BOSS_REMOVAL_ART,
  bossRemovalView,
  characterState,
  chunkBackdropSpan,
  chunkParallax,
  type CrumblingSkin,
  crumblingSkinTiles,
  forceVisualPosition,
  interiorBackdrop,
  loadedTileset,
  nextQuirkAt,
  objectTiles,
  phaseSkinTiles,
  type PlacedTile,
  scenerySpriteFrame,
  tetherLine,
} from "../presentation/index.ts";
import { forcePulseVolume } from "../rules/bird/index.ts";
import {
  type BehaviourState,
  effectiveGustPhase,
  effectiveHazardPhase,
  effectiveSupportPhase,
  phaseFollowerTag,
  removalProgress,
  timedHazardRect,
} from "../rules/boss/index.ts";
import { areaOf, type ZoneState } from "../rules/zone/index.ts";
import { sceneryParallax, type Tileset, worldScenery } from "../stage/index.ts";
import { reducedMotion } from "../ui/index.ts";
import { backdropBottomFrame } from "./backdropBottomFrame.ts";
import { mountBossWarning } from "./bossWarning.ts";
import { createCrumblingArt } from "./crumblingArt.ts";
import { createPulseSpanArt } from "./pulseSpanArt.ts";
import { paletteColour } from "./scenePalette.ts";
import { createTetherArt } from "./tetherArt.ts";
import { createPhaseTileArt, createTimedHazardArt } from "./timedHazard.ts";

const OBJECT_COLOURS: Readonly<Record<Collision, number>> = {
  hazard: 0xe43b44,
  ledge: 0xc0cbdc,
  none: 0xf6757a,
  solid: 0xe4a672,
  use: 0x63c74d,
};
// A gust emitter's and its leaf stream's placeholder colour until their sprites exist: green, never
// the red or amber of danger.
const GUST_PLACEHOLDER = 0x9ad48c;
// A clocked support's placeholder opacity per phase, until its sprite exists.
const SUPPORT_PLACEHOLDER_ALPHA: Readonly<Record<SupportPhase, number>> = {
  absent: 0.2,
  present: 1,
  warning: 0.6,
};
// Back to front: repeated backdrops, placed backdrops, the terrain, objects, him, and the touch
// controls. An area's art is added whenever it is drawn.
export const ZONE_ART_DEPTHS: Readonly<Record<ArtKind | "terrain", number>> = {
  backdrop: -3,
  placeholder: 0,
  "repeated-backdrop": -4,
  sprite: 0,
  terrain: -2,
  tiles: -1,
};
const WORLD_SCENERY_DEPTH = (ZONE_ART_DEPTHS.backdrop + ZONE_ART_DEPTHS.terrain) / 2;

// Everything drawn for one object, placed at its top-left corner plus offset. A sprite faces the
// way it last moved.
interface ObjectArt {
  // A crumbling object's intact and warning tile images.
  readonly crumbling?: Readonly<Record<CrumblingSkin, readonly GameObjects.Image[]>>;
  disposed?: boolean;
  readonly item: GameObjects.Components.Transform & GameObjects.GameObject;
  readonly offset: Point;
  // The flat rectangle drawn where the object has no art.
  readonly placeholder?: GameObjects.Rectangle;
  readonly scenery?: boolean;
  readonly timedHazard?: ReturnType<typeof createTimedHazardArt>["draw"];
  // When its next quirk plays, and the draws that time it.
  readonly quirk?: { at: number; readonly random: Random };
  readonly sprite: GameObjects.Sprite | undefined;
  readonly tether?: ReturnType<typeof createTetherArt>;
}

// Starts a sprite's tag, unless it already shows it, playing or finished on its last frame.
export function showZoneSprite(sprite: GameObjects.Sprite, tag: string): void {
  const key = animationKey(sprite.texture.key, tag);
  if (sprite.anims.currentAnim?.key !== key) {
    sprite.play(key);
  }
}

interface ZoneObjectArtAssets {
  readonly manifest: ArtManifest;
  readonly sheet: (key: string) => ReadonlyMap<string, readonly AnimationFrame[]>;
  readonly warning: ReturnType<typeof mountBossWarning> | undefined;
}

export function createZoneObjectArt(scene: Scene, assets: ZoneObjectArtAssets) {
  return new ZoneObjectArt(scene, assets);
}

class ZoneObjectArt {
  private readonly scene: Scene;
  private readonly manifest: ArtManifest;
  private readonly sheet: ZoneObjectArtAssets["sheet"];
  private readonly bossWarning: ZoneObjectArtAssets["warning"];
  private objectArt: ObjectArt[] = [];
  private crumblingArt: ReturnType<typeof createCrumblingArt> | undefined;
  private readonly chunkBackdrops: {
    readonly bounds: Rect;
    readonly item: GameObjects.TileSprite;
    readonly extension?: GameObjects.TileSprite;
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
  // Each spanning pulse visual, by pulse id.
  private readonly pulseSpans = new Map<number, ReturnType<typeof createPulseSpanArt>>();
  // Each dead boss's removal puff, by object index.
  private readonly removalArt = new Map<number, GameObjects.Sprite>();
  private readonly transientArt = new Map<number, ObjectArt>();

  constructor(scene: Scene, assets: ZoneObjectArtAssets) {
    this.scene = scene;
    this.manifest = assets.manifest;
    this.sheet = assets.sheet;
    this.bossWarning = assets.warning;
  }
  reset(layout: ZoneLayout, zone: ZoneState): void {
    const area = areaOf(layout, zone.area);
    this.chunkBackdrops.length = 0;
    this.scenerySprites.length = 0;
    for (const art of this.objectArt) {
      if (!art.disposed) {
        art.item.destroy();
      }
      art.tether?.destroy();
    }
    for (const art of this.transientArt.values()) {
      art.item.destroy();
    }
    this.transientArt.clear();
    for (const art of this.pulseArt.values()) {
      art.destroy();
    }
    this.pulseArt.clear();
    for (const art of this.pulseSpans.values()) {
      art.destroy();
    }
    this.pulseSpans.clear();
    for (const art of this.removalArt.values()) {
      art.destroy();
    }
    this.removalArt.clear();
    this.objectArt = area.objects.map((object, index) => {
      const key = object.tileset === null ? undefined : (object.tileset ?? area.tileset);
      const source = loadedTileset(
        TILE,
        (name) => this.scene.cache.json.get(name) as Tileset | undefined,
        key,
      );
      const art = this.drawObject(layout, zone, key, source, object, index);
      return object.tether ? { ...art, tether: this.drawTether(object.tether.art) } : art;
    });
    this.crumblingArt = area.crumbling && this.drawCrumbling(area);
  }

  sprite(index: number): GameObjects.Sprite | undefined {
    return this.objectArt[index]?.sprite;
  }

  freezePreviewAnimations(): void {
    for (const sprite of this.objectArt.flatMap((art) => (art.sprite ? [art.sprite] : []))) {
      const frame = sprite.anims.isPlaying
        ? sprite.anims.currentAnim?.frames[0]?.textureFrame
        : undefined;
      sprite.anims.stop();
      if (frame !== undefined) {
        sprite.setFrame(frame);
      }
    }
  }

  pauseAnimations(): void {
    for (const art of [...this.objectArt, ...this.transientArt.values()]) {
      art.sprite?.anims.pause();
    }
    for (const art of this.pulseArt.values()) {
      art.anims.pause();
    }
    for (const art of this.pulseSpans.values()) {
      art.pause();
    }
  }

  releaseTracking(): void {
    this.chunkBackdrops.length = 0;
    this.scenerySprites.length = 0;
  }

  // Only objects crumble on screen: each swaps between its dedicated intact and warning skins.
  private drawCrumbling(area: AreaLayout): ReturnType<typeof createCrumblingArt> {
    const targets = (area.crumbling ?? []).map(({ supportId }) => {
      const skins = this.objectArt[area.objects.indexOf(supportId as ObjectLayout)]?.crumbling;
      if (!skins) {
        throw new Error("Crumbling terrain has no registered skin");
      }
      return { skins, supportId };
    });
    return createCrumblingArt(targets);
  }

  // A tether one depth behind the objects: its sprite once art has it, else a placeholder line.
  private drawTether(art: string): ReturnType<typeof createTetherArt> {
    const sprite = this.manifest.sprites.some(({ key }) => key === art)
      ? { key: art, size: this.scene.textures.getFrame(art).height }
      : undefined;
    return createTetherArt(ZONE_ART_DEPTHS.sprite - 1, sprite, OBJECT_COLOURS.ledge, this.scene);
  }

  private drawObject(
    layout: ZoneLayout,
    zone: ZoneState,
    key: string | undefined,
    tileset: Tileset | undefined,
    object: ObjectLayout,
    index: number,
  ): ObjectArt {
    if (object.crumbling) {
      if (!key || !tileset) {
        throw new Error(`No crumbling skin for ${object.art} without a tileset`);
      }
      const tiles = crumblingSkinTiles(tileset, object);
      const image = ({ col, index, row }: PlacedTile) =>
        this.scene.add.image(col * TILE, row * TILE, key, index).setOrigin(0);
      const crumbling = {
        intact: tiles.intact.map(image),
        warning: tiles.warning.map((placed) => image(placed).setVisible(false)),
      };
      const item = this.scene.add
        .container(0, 0, [...crumbling.intact, ...crumbling.warning])
        .setDepth(ZONE_ART_DEPTHS.tiles);
      return { crumbling, item, offset: { x: 0, y: 0 }, sprite: undefined };
    }
    if (effectiveHazardPhase(object, undefined) !== undefined) {
      const skin = key && tileset ? phaseSkinTiles(tileset, object) : undefined;
      if (key && skin) {
        const { draw, item } = createPhaseTileArt(ZONE_ART_DEPTHS.tiles, key, skin, this.scene);
        return { item, offset: { x: 0, y: 0 }, sprite: undefined, timedHazard: draw };
      }
      const { draw, item } = createTimedHazardArt(
        ZONE_ART_DEPTHS.sprite,
        (name) => paletteColour(this.scene, name),
        this.scene,
      );
      return { item, offset: { x: 0, y: 0 }, sprite: undefined, timedHazard: draw };
    }
    const kind = artKind(this.manifest, tileset, object.art);
    const scenery = kind === "sprite" ? sceneryParallax(object) : undefined;
    const world = kind === "sprite" && worldScenery(object);
    const parallax = scenery ?? artScrollFactor(kind, object.parallax);
    const rect = { height: object.height, width: object.width };
    if (object.backdropPlane === "interior" && kind !== "repeated-backdrop") {
      throw new Error(`Interior backdrop requires repeated art: ${object.art}`);
    }
    if (
      object.backdropExtendBottom &&
      (kind !== "repeated-backdrop" || !object.backdropSpan || object.backdropPlane !== undefined)
    ) {
      throw new Error("Bottom backdrop extension requires repeat-X outdoor art");
    }
    switch (kind) {
      case "tiles": {
        const images = objectTiles(
          tileset as Tileset,
          object.art,
          rect.width / TILE,
          rect.height / TILE,
        ).map(({ col, index, row }) =>
          this.scene.add.image(col * TILE, row * TILE, key as string, index).setOrigin(0),
        );
        const item = this.scene.add.container(0, 0, images).setDepth(ZONE_ART_DEPTHS.tiles);
        return { item, offset: { x: 0, y: 0 }, sprite: undefined };
      }
      case "backdrop": {
        const item = this.scene.add
          .image(0, 0, object.art)
          .setOrigin(0)
          .setScrollFactor(parallax.x, parallax.y)
          .setDepth(ZONE_ART_DEPTHS.backdrop);
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
              { area: areaOf(layout, zone.area), camera: CAMERA, screen: SCREEN },
              object.groundAnchor,
            ).scroll,
            textureTop: backdrop.y - backdrop.height,
          };
          const item = this.scene.add
            .tileSprite(object.origin.x, object.origin.y, rect.width, rect.height, object.art)
            .setOrigin(0)
            .setScrollFactor(1, 1)
            .setDepth((ZONE_ART_DEPTHS["repeated-backdrop"] + ZONE_ART_DEPTHS.backdrop) / 2);
          this.chunkBackdrops.push({
            bounds: { ...object.origin, ...rect },
            item,
            parallax,
            reference,
          });
          return { item, offset: { x: 0, y: 0 }, sprite: undefined };
        }
        const height = this.scene.textures.getFrame(object.art).height;
        const span = chunkBackdropSpan(areaOf(layout, zone.area), object);
        const offset = artOffset(kind, rect, { height, width: rect.width });
        const item = this.scene.add
          .tileSprite(0, 0, rect.width, height, object.art)
          .setOrigin(0)
          .setScrollFactor(span ? 1 : parallax.x, span ? 1 : parallax.y)
          .setDepth(ZONE_ART_DEPTHS["repeated-backdrop"]);
        if (span) {
          const extension = object.backdropExtendBottom
            ? this.scene.add
                .tileSprite(
                  0,
                  0,
                  span.width,
                  1,
                  object.art,
                  backdropBottomFrame(this.scene.textures.get(object.art)),
                )
                .setOrigin(0)
                .setScrollFactor(1, 1)
                .setDepth(ZONE_ART_DEPTHS["repeated-backdrop"])
                .setVisible(false)
            : undefined;
          if (extension) {
            item.once("destroy", () => extension.destroy());
          }
          this.chunkBackdrops.push({
            bounds: {
              height,
              width: span.width,
              x: span.x,
              y:
                object.origin.y +
                offset.y +
                backgroundGroundOffset(
                  { area: areaOf(layout, zone.area), camera: CAMERA, screen: SCREEN },
                  object,
                ),
            },
            ...(extension && { extension }),
            item,
            parallax,
          });
        }
        return { item, offset, sprite: undefined };
      }
      case "sprite": {
        const sprite = this.scene.add
          .sprite(0, 0, object.art)
          .setOrigin(0)
          .setDepth(
            world
              ? WORLD_SCENERY_DEPTH
              : scenery
                ? ZONE_ART_DEPTHS.backdrop
                : ZONE_ART_DEPTHS.sprite,
          );
        if (world) {
          sprite.setScrollFactor(1, 1);
          if (object.motion.playback === "once-visible") {
            sprite.setVisible(zone.sceneryPlayback?.[index]?.status === "active");
          }
        }
        const tag = object.animations.idle ?? [...this.sheet(object.art).keys()][0];
        if (tag !== undefined) {
          showZoneSprite(sprite, tag);
        }
        const offset = artOffset(kind, rect, sprite.frame);
        if (scenery) {
          const area = areaOf(layout, zone.area);
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
        const random = randomStream(zone.seed + zone.attempt, `${zone.area}:${index}:quirk`);
        return {
          item: sprite,
          offset,
          ...(scenery && { scenery: true }),
          ...(quirk && { quirk: { at: nextQuirkAt(random, quirk, 0), random } }),
          sprite,
        };
      }
      default: {
        const colour =
          effectiveGustPhase(object, undefined) === undefined
            ? OBJECT_COLOURS[object.collision]
            : GUST_PLACEHOLDER;
        const item = this.scene.add
          .rectangle(0, 0, rect.width, rect.height, colour)
          .setOrigin(0)
          .setDepth(ZONE_ART_DEPTHS.placeholder);
        return { item, offset: { x: 0, y: 0 }, placeholder: item, sprite: undefined };
      }
    }
  }

  // Camera changes also reach paused previews and death captures before their next render.
  renderBackdrops(): void {
    const camera = this.scene.cameras.main;
    const scroll = { x: camera.scrollX, y: camera.scrollY };
    for (const { bounds, extension, item, parallax, reference } of this.chunkBackdrops) {
      if (reference) {
        const { position, textureX, textureY } = interiorBackdrop(
          { parallax, reference: reference.scroll, scroll, textureTop: reference.textureTop },
          bounds,
        );
        item.setPosition(position.x, position.y).setTilePosition(textureX, textureY);
      } else {
        const { position, textureX } = chunkParallax({ parallax, scroll }, bounds);
        item.setPosition(position.x, position.y).setTilePosition(textureX, 0);
        if (extension) {
          const fill = backdropBottomRect(
            { height: camera.height / camera.zoomY, y: scroll.y },
            { ...bounds, ...position },
          );
          extension.setVisible(fill !== undefined);
          if (fill) {
            extension
              .setPosition(fill.x, fill.y)
              .setSize(fill.width, fill.height)
              .setTilePosition(textureX, 0);
          }
        }
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
  draw(layout: ZoneLayout, openingIndex: number | undefined, zone: ZoneState): void {
    this.bossWarning?.clear();
    const area = areaOf(layout, zone.area);
    const { bird } = zone;
    const hers = { x: bird.x + BIRD.width / 2, y: bird.y + BIRD.height / 2 };
    zone.objects.forEach((at, index) => {
      const art = this.objectArt[index];
      const object = area.objects[index];
      if (!art || !object) {
        return;
      }
      if (object.motion.playback === "once-visible") {
        const status = zone.sceneryPlayback?.[index]?.status ?? "waiting";
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
      const behaviour = zone.behaviours[index];
      if (art.timedHazard) {
        const phase = effectiveHazardPhase(object, behaviour);
        if (phase === undefined) {
          throw new Error(`Missing timed hazard phase for ${object.character}`);
        }
        art.timedHazard(phase, timedHazardRect(object, at));
        return;
      }
      const support = art.placeholder && effectiveSupportPhase(object, behaviour);
      if (support !== undefined) {
        art.placeholder!.setAlpha(SUPPORT_PLACEHOLDER_ALPHA[support]);
      }
      if (object.phaseSource !== undefined) {
        if (art.sprite) {
          const source = area.objects[object.phaseSource]!;
          showZoneSprite(
            art.sprite,
            phaseFollowerTag(source, zone.behaviours[object.phaseSource], object),
          );
        }
      } else if (behaviour) {
        if (art.sprite) {
          const pose = behaviourPose(object, behaviour);
          if (art.sprite.flipX !== pose.flipX) {
            art.sprite.setFlipX(pose.flipX);
          }
          if (object.contact) {
            if (!behaviour.animationTag) {
              throw new Error(`Missing rendered silhouette pose for ${object.art}`);
            }
            if (art.sprite.anims.isPlaying) {
              art.sprite.anims.stop();
            }
            const { frame } = contactFrameAt(
              object.contact,
              behaviour.animationTag,
              behaviour.animationSeconds ?? 0,
            );
            if (art.sprite.frame.name !== frame) {
              art.sprite.setFrame(frame);
            }
          } else if (pose.animation !== undefined) {
            showZoneSprite(art.sprite, pose.animation);
          }
        }
      } else if (art.sprite && index !== openingIndex) {
        if (!art.scenery && x !== art.item.x) {
          art.sprite.setFlipX(x < art.item.x);
        }
        const mine = { x: at.x + object.width / 2, y: at.y + object.height / 2 };
        this.animate(zone.seconds, art, object, characterState(object, moved, mine, hers));
      }
      const position = object.contact
        ? spriteFrameOrigin(object.contact.frame, object, at)
        : { x, y };
      if (art.item.x !== position.x || art.item.y !== position.y) {
        art.item.setPosition(position.x, position.y);
      }
      const tether = art.tether && tetherLine(area.objects, zone.objects, object, at);
      if (tether) {
        art.tether!.draw(tether);
      }
      if (behaviour?.defeat) {
        this.drawRemoval(index, art, behaviour);
        return;
      }
      if (art.sprite) {
        this.bossWarning?.draw(behaviour, art.sprite, object.contact);
      }
    });
    this.crumblingArt?.draw(zone.crumbling);
    this.drawTransients(layout, zone);
    this.drawPulses(zone);
  }

  // A dead boss's removal: Art's puff where its texture is loaded, otherwise a fade.
  private drawRemoval(index: number, art: ObjectArt, behaviour: BehaviourState): void {
    const view = bossRemovalView(
      removalProgress(behaviour)!,
      this.scene.textures.exists(BOSS_REMOVAL_ART.key),
      reducedMotion(window),
    );
    let puff = this.removalArt.get(index);
    if (view.kind === "fade") {
      art.sprite?.setAlpha(view.alpha);
      return;
    }
    art.sprite?.setVisible(false);
    if (view.kind === "removed") {
      puff?.destroy();
      this.removalArt.delete(index);
      return;
    }
    if (!puff && art.sprite) {
      puff = this.scene.add
        .sprite(
          art.item.x + art.sprite.width / 2,
          art.item.y + art.sprite.height / 2,
          BOSS_REMOVAL_ART.key,
        )
        .setOrigin(0.5)
        .setDepth(ZONE_ART_DEPTHS.sprite);
      if (view.play) {
        showZoneSprite(puff, BOSS_REMOVAL_ART.tag);
      } else {
        // Reduced motion holds the effect's peak frame, the tag's first.
        const first = this.scene.anims.get(animationKey(BOSS_REMOVAL_ART.key, BOSS_REMOVAL_ART.tag))
          ?.frames[0]?.textureFrame;
        if (first !== undefined) {
          puff.setFrame(first);
        }
      }
      this.removalArt.set(index, puff);
    }
  }

  private drawPulses(zone: ZoneState): void {
    const alive = new Set(zone.pulses.map((pulse) => pulse.id));
    for (const [id, sprite] of this.pulseArt) {
      if (!alive.has(id)) {
        sprite.destroy();
        this.pulseArt.delete(id);
      }
    }
    for (const [id, art] of this.pulseSpans) {
      if (!alive.has(id)) {
        art.destroy();
        this.pulseSpans.delete(id);
      }
    }
    for (const pulse of zone.pulses) {
      const visual = pulse.visual;
      if (!visual) {
        continue;
      }
      if (visual.span) {
        let span = this.pulseSpans.get(pulse.id);
        if (!span) {
          const frame = this.manifest.sprites.some(({ key }) => key === visual.art)
            ? this.scene.textures.getFrame(visual.art)
            : undefined;
          span = createPulseSpanArt(
            ZONE_ART_DEPTHS.sprite,
            frame && { height: frame.realHeight, key: visual.art, width: frame.realWidth },
            GUST_PLACEHOLDER,
            this.scene,
          );
          this.pulseSpans.set(pulse.id, span);
        }
        span.draw(forcePulseVolume(pulse), pulse.facing, visual.animation);
        continue;
      }
      let sprite = this.pulseArt.get(pulse.id);
      if (!sprite) {
        sprite = this.scene.add
          .sprite(0, 0, visual.art)
          .setOrigin(0)
          .setDepth(ZONE_ART_DEPTHS.sprite);
        this.pulseArt.set(pulse.id, sprite);
      }
      const actor = this.scene.textures.getFrame(visual.actor.art);
      const at = forceVisualPosition(
        { height: actor.realHeight, width: actor.realWidth },
        visual.actor,
        { height: sprite.frame.realHeight, width: sprite.frame.realWidth },
        visual.offset,
        pulse.facing,
        visual.at,
      );
      sprite.setFlipX(pulse.facing === -1).setPosition(Math.round(at.x), Math.round(at.y));
      showZoneSprite(sprite, visual.animation);
    }
  }

  private drawTransients(layout: ZoneLayout, zone: ZoneState): void {
    const alive = new Set(zone.transients.map((entity) => entity.id));
    for (const [id, art] of this.transientArt) {
      if (!alive.has(id)) {
        art.item.destroy();
        this.transientArt.delete(id);
      }
    }
    for (const entity of zone.transients) {
      let art = this.transientArt.get(entity.id);
      if (!art) {
        art = this.drawObject(layout, zone, undefined, undefined, entity.object, entity.id);
        this.transientArt.set(entity.id, art);
      }
      art.item.setPosition(
        Math.round(entity.at.x + art.offset.x),
        Math.round(entity.at.y + art.offset.y),
      );
      const tag =
        entity.age < entity.armSeconds ? entity.armingAnimation : entity.object.animations.idle;
      if (art.sprite && tag !== undefined) {
        showZoneSprite(art.sprite, tag);
      }
    }
  }

  // Plays the tag for a character's state, or while it idles, its quirks when they come due, each
  // timed by the attempt's random draws so a restart rolls them afresh.
  private animate(
    seconds: number,
    art: ObjectArt,
    object: ObjectLayout,
    state: CharacterState,
  ): void {
    const sprite = art.sprite as GameObjects.Sprite;
    const quirk = object.quirks[0];
    const playingQuirk =
      quirk !== undefined &&
      sprite.anims.isPlaying &&
      sprite.anims.currentAnim?.key === animationKey(object.art, quirk.tag);
    if (state === "idle" && quirk && art.quirk) {
      if (seconds >= art.quirk.at) {
        sprite.play(animationKey(object.art, quirk.tag));
        art.quirk.at = nextQuirkAt(art.quirk.random, quirk, seconds);
        return;
      }
      if (playingQuirk) {
        return;
      }
    }
    const tag = object.animations[state];
    if (tag !== undefined) {
      showZoneSprite(sprite, tag);
    }
  }
}
