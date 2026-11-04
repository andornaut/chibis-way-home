// Art's removal for a dead boss: the `boss-removal` sprite's `puff` tag, centred on the boss's
// frame centre and played once. Until that texture exists the boss sprite fades instead; both
// take the rules' removal time.
export const BOSS_REMOVAL_ART = { key: "boss-removal", tag: "puff" } as const;

export type BossRemovalView =
  | { readonly kind: "fade"; readonly alpha: number }
  | { readonly kind: "puff" }
  | { readonly kind: "removed" };

// What a dead boss shows at a removal progress from 0 to 1, given whether the puff is loaded.
export function bossRemovalView(progress: number, puffLoaded: boolean): BossRemovalView {
  return progress >= 1
    ? { kind: "removed" }
    : puffLoaded
      ? { kind: "puff" }
      : { alpha: 1 - progress, kind: "fade" };
}
