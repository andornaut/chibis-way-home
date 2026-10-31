import type {
  Archetype,
  AreaLayout,
  AreaPlan,
  ArtHitbox,
  Character,
  CharacterState,
  Instance,
  Interaction,
  Motion,
  ObjectLayout,
  Point,
  Reaction,
  Rect,
  Size,
  TilePoint,
  TileRect,
  ZoneLayout,
  ZonePlan,
} from "../data/types";
import { drawsFrom, tileHitbox, type Tileset } from "../view/tiles";
import { layoutBehaviour } from "./behaviour";
import { validateZoneLinks } from "./zoneLinks";

export function tileRect(tile: number, rect: TileRect): Rect {
  return {
    height: rect.rows * tile,
    width: rect.cols * tile,
    x: rect.col * tile,
    y: rect.row * tile,
  };
}

function tilePoint(tile: number, point: TilePoint): Point {
  return { x: point.col * tile, y: point.row * tile };
}

// The archetypes and characters instances are resolved against.
export interface Catalogue {
  readonly archetypes: Readonly<Record<string, Archetype>>;
  readonly characters: Readonly<Record<string, Character>>;
}

const STATES: readonly CharacterState[] = ["idle", "move", "react", "talk"];
// The tag a door's open state plays when its character names none.
const OPEN_TAG = "open";

// The character and archetype an instance names, or an error naming what is missing.
export function resolveNames(
  catalogue: Catalogue,
  instance: Instance,
): { archetype: Archetype; character: Character } {
  const character = catalogue.characters[instance.character];
  if (!character) {
    throw new Error(`No character ${instance.character}`);
  }
  const archetype = catalogue.archetypes[character.archetype];
  if (!archetype) {
    throw new Error(`No archetype ${character.archetype} for ${instance.character}`);
  }
  return { archetype, character };
}

function alignedHitbox(art: ArtHitbox, width: number, height: number): Rect {
  return {
    ...art.hitbox,
    x: art.hitbox.x + (width - art.frame.width) / 2,
    y: art.hitbox.y + height - art.frame.height,
  };
}

function sameRect(a: Rect, b: Rect): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

// An instance resolved into one flat object, in pixels: its instance's overrides over its
// character's tuning over its archetype, and the character's art, animations (a state left out
// plays idle's, and open the tag named "open"), words and quirks, which an instance's own lines
// replace. Its hit box is its sprite's, from hitboxes, or for art drawn from its area's tileset,
// its tiles'. A door without a room, or a room on anything but a door, is refused.
export function objectLayout(
  tile: number,
  catalogue: Catalogue,
  hitboxes: Readonly<Record<string, ArtHitbox>>,
  tileset: Tileset | undefined,
  skinTilesets: Readonly<Record<string, Tileset>>,
  instance: Instance,
): ObjectLayout {
  const { archetype, character } = resolveNames(catalogue, instance);
  if ((archetype.collision === "use") !== (instance.room !== undefined)) {
    throw new Error(
      archetype.collision === "use"
        ? `Door ${instance.character} at col ${instance.col} row ${instance.row} has no room`
        : `${instance.character} at col ${instance.col} row ${instance.row} is not a door`,
    );
  }
  const motion: Motion = {
    ...archetype.motion,
    ...character.tuning?.motion,
    ...instance.overrides?.motion,
  };
  const reaction: Reaction = {
    ...archetype.reaction,
    ...character.tuning?.reaction,
    ...instance.overrides?.reaction,
  };
  const interaction: Interaction = {
    ...archetype.interaction,
    ...character.tuning?.interaction,
    ...instance.overrides?.interaction,
  };
  const pattern = instance.behaviour ?? character.behaviour;
  const behaviour = pattern && layoutBehaviour(tile, pattern);
  if (behaviour && (instance.phase ?? 0) !== 0) {
    throw new Error(`Behaviour ${instance.character} uses its initial state, not a motion phase`);
  }
  const parallax = instance.parallax;
  if (parallax) {
    if (
      [parallax.x, parallax.y].some(
        (factor) => !Number.isFinite(factor) || factor < 0 || factor > 1,
      )
    ) {
      throw new Error(`Invalid parallax for ${instance.character}: factors must be from 0 to 1`);
    }
    if (
      (parallax.x !== 1 || parallax.y !== 1) &&
      (archetype.collision !== "none" ||
        interaction.kind !== "none" ||
        motion.algorithm !== "static" ||
        reaction.kind !== "none" ||
        (behaviour &&
          Object.values(behaviour.states).some(
            (node) => node.motion.kind === "move" || node.motion.kind === "hop",
          )))
    ) {
      throw new Error(
        `Parallax on ${instance.character} requires static scenery without interaction`,
      );
    }
  }
  const width = (instance.cols ?? character.cols) * tile;
  const height = (instance.rows ?? character.rows) * tile;
  const art = hitboxes[character.art];
  const hitbox = art
    ? alignedHitbox(art, width, height)
    : tileset && tileHitbox(tile, tileset, character.art, width / tile, height / tile);
  const skin = instance.skin;
  if (skin) {
    const visualTileset = skin.tileset === null ? undefined : skinTilesets[skin.tileset];
    if (
      skin.tileset !== null &&
      (!visualTileset || visualTileset.tileSize !== tile || !drawsFrom(visualTileset, skin.art))
    ) {
      throw new Error(`Invalid skin tileset or art ${skin.tileset}:${skin.art}`);
    }
    if (archetype.collision !== "none") {
      const piece = visualTileset?.pieces[skin.art];
      if (
        piece &&
        (piece.length * tile !== height || piece.some((row) => row.length * tile !== width))
      ) {
        throw new Error(`Skin ${skin.art} changes the collidable footprint`);
      }
      const visualArt = skin.tileset === null ? hitboxes[skin.art] : undefined;
      const visualHitbox = visualArt
        ? alignedHitbox(visualArt, width, height)
        : visualTileset && tileHitbox(tile, visualTileset, skin.art, width / tile, height / tile);
      const full = { height, width, x: 0, y: 0 };
      if (!sameRect(hitbox ?? full, visualHitbox ?? full)) {
        throw new Error(`Skin ${skin.art} changes the canonical hitbox`);
      }
    }
  }
  const idle = character.animations?.idle;
  return {
    animations: {
      ...(Object.fromEntries(
        STATES.map((state) => [state, character.animations?.[state] ?? idle]),
      ) as Record<Exclude<CharacterState, "open">, string | undefined>),
      open: character.animations?.open ?? OPEN_TAG,
    },
    art: skin?.art ?? character.art,
    ...(skin
      ? { tileset: skin.tileset }
      : character.tileset !== undefined
        ? { tileset: character.tileset }
        : {}),
    character: instance.character,
    ...(behaviour && { behaviour }),
    collision: archetype.collision,
    height,
    hitbox,
    interaction: { ...interaction, range: interaction.range * tile },
    lines: instance.lines ?? character.lines ?? [],
    motion: {
      ...motion,
      distance: motion.distance * tile,
      hopHeight: motion.hopHeight * tile,
      speed: motion.speed * tile,
    },
    origin: tilePoint(tile, instance),
    ...(parallax && { parallax }),
    phase: instance.phase ?? 0,
    quips: character.quips ?? [],
    quirks: character.quirks ?? [],
    reaction: { ...reaction, range: reaction.range * tile, speed: reaction.speed * tile },
    room: instance.room,
    scene: instance.scene,
    width,
  };
}

// Whether an instance is placed, given the carried-choice flags that are set: every flag it
// requires is set and none it excludes is.
export function isPlaced(flags: ReadonlySet<string>, instance: Instance): boolean {
  return (
    (instance.requires ?? []).every((flag) => flags.has(flag)) &&
    !(instance.excludes ?? []).some((flag) => flags.has(flag))
  );
}

export function areaLayout(
  tile: number,
  catalogue: Catalogue,
  hitboxes: Readonly<Record<string, ArtHitbox>>,
  tilesets: Readonly<Record<string, Tileset>>,
  flags: ReadonlySet<string>,
  area: AreaPlan,
): AreaLayout {
  const tileset = area.tileset === undefined ? undefined : tilesets[area.tileset];
  return {
    ...(area.walkLinks && { walkLinks: area.walkLinks }),
    backX: tile,
    chunks: (area.chunks ?? []).map(({ col, cols }) => ({ width: cols * tile, x: col * tile })),
    entries: Object.fromEntries(
      Object.entries(area.entries).map(([name, point]) => [name, tilePoint(tile, point)]),
    ),
    exitX: (area.cols - 1) * tile,
    height: area.rows * tile,
    objects: area.objects
      .filter((instance) => isPlaced(flags, instance))
      .map((instance) => {
        const key = resolveNames(catalogue, instance).character.tileset;
        const source = key === undefined ? tileset : tilesets[key];
        if (key !== undefined && !source) {
          throw new Error(`No tileset ${key} for ${instance.character}`);
        }
        return objectLayout(tile, catalogue, hitboxes, source, tilesets, instance);
      }),
    solids: area.solids.map((rect) => tileRect(tile, rect)),
    terrain: area.solids,
    tileset: area.tileset,
    width: area.cols * tile,
  };
}

// A zone plan in base pixels, for the rules: each instance resolved against the catalogue, with
// the hit boxes art declares by art key and in its tilesets by tile, and only the instances the
// set flags place. birdFrame: her drawn frame's size, which Use reaches with.
export function zoneLayout(
  tile: number,
  birdFrame: Size,
  catalogue: Catalogue,
  hitboxes: Readonly<Record<string, ArtHitbox>>,
  tilesets: Readonly<Record<string, Tileset>>,
  flags: ReadonlySet<string>,
  plan: ZonePlan,
): ZoneLayout {
  const layout: ZoneLayout = {
    ...(plan.areaOrder && { areaOrder: plan.areaOrder }),
    areas: Object.fromEntries(
      Object.entries(plan.areas).map(([name, area]) => [
        name,
        areaLayout(tile, catalogue, hitboxes, tilesets, flags, area),
      ]),
    ),
    birdFrame,
    start: plan.start,
  };
  validateZoneLinks(layout);
  return layout;
}
