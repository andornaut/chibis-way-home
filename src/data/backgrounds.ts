import type { BackgroundSection, ThemePlan } from "./types/index.ts";

const SECTION_WIDTHS = [40, 60, 80] as const;

function sections(
  groundAnchor: "start" | undefined,
  farRole: string,
  midRole: string,
): Readonly<Record<string, BackgroundSection>> {
  return Object.fromEntries(
    SECTION_WIDTHS.map((cols) => [
      `${farRole}-${cols}`,
      {
        backdrops: [
          {
            character: "street-city-far",
            ...(groundAnchor === undefined ? {} : { groundAnchor }),
            parallax: { x: 0.15, y: 0.05 },
            role: farRole,
            row: 0,
          },
          {
            character: "street-city-mid",
            ...(groundAnchor === undefined ? {} : { groundAnchor }),
            parallax: { x: 0.4, y: 0.15 },
            role: midRole,
            row: 0,
          },
        ],
        cols,
      },
    ]),
  );
}

export const BACKGROUND_SECTIONS: Readonly<Record<string, BackgroundSection>> = {
  ...sections("start", "far-background", "mid-background"),
  ...sections(undefined, "woodland-far", "woodland-mid"),
};

export function outdoorBackground(woodland = false): NonNullable<ThemePlan["background"]> {
  const farRole = woodland ? "woodland-far" : "far-background";
  return {
    sections: SECTION_WIDTHS.map((cols) => `${farRole}-${cols}`),
    weather: [{ character: "street-sky", parallax: { x: 0, y: 0 }, role: "sky", row: 0 }],
  };
}
