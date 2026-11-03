export interface BossWarningTuning {
  readonly colour: string;
  readonly inkColour: string;
  readonly inkWidth: number;
  readonly strokeWidth: number;
}

export const BOSS_WARNING = {
  colour: "warning-red",
  inkColour: "ink",
  inkWidth: 1,
  strokeWidth: 1,
} as const satisfies BossWarningTuning;
