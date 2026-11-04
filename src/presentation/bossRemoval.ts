// Art's removal for a dead boss: the `boss-removal` sprite's `puff` tag, centred on the boss's
// frame centre and played once. With reduced motion the puff holds its peak first frame instead.
// Until that texture exists the boss sprite fades; every path takes the rules' removal time.
export const BOSS_REMOVAL_ART = { key: "boss-removal", tag: "puff" } as const;

export type BossRemovalView =
  | { readonly kind: "fade"; readonly alpha: number }
  | { readonly kind: "puff"; readonly play: boolean }
  | { readonly kind: "removed" };

// What a dead boss shows at a removal progress from 0 to 1, given whether the puff is loaded and
// whether motion is reduced.
export function bossRemovalView(
  progress: number,
  puffLoaded: boolean,
  reducedMotion: boolean,
): BossRemovalView {
  return progress >= 1
    ? { kind: "removed" }
    : puffLoaded
      ? { kind: "puff", play: !reducedMotion }
      : { alpha: 1 - progress, kind: "fade" };
}
