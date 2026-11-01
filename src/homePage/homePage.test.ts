import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import manifest from "../../public/art/manifest.json";
import { CHUNKS } from "../data/chunks";
import { TEXT } from "../data/text";
import { RECIPES } from "../data/zones";
import { keyIntent } from "../input/intent";
import { cardKeyAction } from "../pause/cardInput";
import { themesOf } from "../rules/assemble";
import { homePageHtml } from "./html";

// The home page and the nav bar are static files, so what they state is checked against the
// game here.
const HOME_PAGE = new URL("../../pages/index.html", import.meta.url);
const NAV_SCRIPT = new URL("../../public/nav.js", import.meta.url);

const pageText = async () =>
  homePageHtml(TEXT, await readFile(HOME_PAGE, "utf8")).replaceAll(/\s+/gu, " ");

function artImage(key: string) {
  const image = manifest.images.find((entry) => entry.key === key);
  return { height: image?.height, src: `/art/${image?.png}`, width: image?.width };
}

it("renders one escaped description in the pitch and metadata", async () => {
  const text = {
    ...TEXT,
    homePage: { ...TEXT.homePage, description: 'A "bird" & <ferret>' },
  };
  const rendered = homePageHtml(text, await readFile(HOME_PAGE, "utf8")).replaceAll(/\s+/gu, " ");
  const description = "A &quot;bird&quot; &amp; &lt;ferret&gt;";
  expect(rendered).toContain(`name="description" content="${description}"`);
  expect(rendered).toContain(`<p class="pitch">${description}</p>`);
  expect(rendered).not.toMatch(/%HOME_[A-Z_]+%/u);
});

describe("the logos", () => {
  it("shows the home page's logo at art's size", async () => {
    const pattern = /<img\s+class="logo"\s+src="([^"]+)"\s+width="(\d+)"\s+height="(\d+)"/u;
    const [, src, width, height] = pattern.exec(await readFile(HOME_PAGE, "utf8")) ?? [];
    expect({ height: Number(height), src, width: Number(width) }).toEqual(artImage("logo"));
  });

  it("shows the nav bar's logos, the column's then the row's, at art's sizes", async () => {
    const pattern = /\{ height: (\d+), src: "([^"]+)", width: (\d+) \}/gu;
    const shown = [...(await readFile(NAV_SCRIPT, "utf8")).matchAll(pattern)].map(
      ([, height, src, width]) => ({ height: Number(height), src, width: Number(width) }),
    );
    expect(shown).toEqual([artImage("logo-icon"), artImage("logo-nav")]);
  });
});

describe("the home page's controls", () => {
  const instructions = async () => {
    const match = /<ul class="keys">\s*<li>(.*?)<\/li>\s*<li>(.*?)<\/li>\s*<\/ul>/u.exec(
      await pageText(),
    );
    expect(match, "rendered touch and keyboard instruction rows").not.toBeNull();
    return { keyboard: match![2]!, touch: match![1]! };
  };

  it("names both actual touch controls in their instruction row", async () => {
    const { touch } = await instructions();
    for (const label of [TEXT.buttons.jump, TEXT.buttons.use]) {
      expect(touch).toContain(label);
    }
  });

  it.each([
    ["Left", /\barrow(?: keys|s)\b/u, () => keyIntent(new Set(["ArrowLeft"])).move === -1],
    ["Right", /\barrow(?: keys|s)\b/u, () => keyIntent(new Set(["ArrowRight"])).move === 1],
    ["Up", /\barrow(?: keys|s)\b/u, () => keyIntent(new Set(["ArrowUp"])).jump],
    ["E", /\bE\b/u, () => keyIntent(new Set(["KeyE"])).use],
    ["P", /\bP\b/u, () => cardKeyAction(false, "p", false) === "open"],
  ])("names the bound %s key in keyboard instructions", async (_key, token, does) => {
    expect({ does: does(), stated: token.test((await instructions()).keyboard) }).toEqual({
      does: true,
      stated: true,
    });
  });
});

// The first stage's available authored features, including optional randomized middle chunks.
const streetRecipe = RECIPES.street;
const streetTheme = streetRecipe && "theme" in streetRecipe ? streetRecipe.theme : "";
const streetCharacters = new Set(
  Object.values(CHUNKS)
    .filter((chunk) => themesOf(chunk).includes(streetTheme))
    .flatMap(({ objects }) => objects.map(({ character }) => character)),
);

describe("the home page's zone 1", () => {
  it.each([[TEXT.homePage.subline, "red-edge-top"]])(
    "states %s, which zone 1 can include",
    async (phrase, character) => {
      expect({
        placed: streetCharacters.has(character),
        stated: (await pageText()).includes(phrase),
      }).toEqual({ placed: true, stated: true });
    },
  );
});
