import type {
  ArenaApproach,
  BackgroundSection,
  Character,
  ChunkPlan,
  ChunkRules,
  SlotKind,
  ThemePlan,
  ZoneRecipe,
} from "../../data/types/index.ts";

// What zones are assembled from: the chunks and themes by key, the chunk rules, the seam rows,
// a zone's height in rows, and the characters by key, for the size of each theme's door.
// arenas: the chunk id of each stage's arena, by stage key.
export interface ChunkLibrary {
  readonly approaches?: Readonly<Record<string, ArenaApproach>>;
  readonly arenas?: Readonly<Record<string, string>>;
  readonly backgrounds?: Readonly<Record<string, BackgroundSection>>;
  readonly characters: Readonly<Record<string, Pick<Character, "cols" | "rows">>>;
  readonly chunks: Readonly<Record<string, ChunkPlan>>;
  readonly rows: number;
  readonly rules: ChunkRules;
  readonly seams: readonly number[];
  readonly themes: Readonly<Record<string, ThemePlan>>;
}

export interface GiftBinding {
  readonly reservedRoom: string;
  readonly room: string | null;
}

export interface StageAssemblyContext extends ChunkLibrary {
  readonly giftBinding?: GiftBinding;
}
export type GiftSlotFills = Readonly<Record<SlotKind, readonly string[]>> &
  Partial<Pick<ZoneRecipe, "start" | "startDoors">> & { readonly giftBinding?: GiftBinding };
