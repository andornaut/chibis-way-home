// Art's palette (public/art/palette.json): named colours and their one-step darker ramp targets.
export interface Palette {
  readonly darker: Readonly<Record<string, string>>;
  readonly colours: Readonly<Record<string, string>>;
}
