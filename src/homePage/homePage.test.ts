import { readFile } from "node:fs/promises";

import { wireInstallButton } from "@andornaut/game-kit/web/pwa/dom/installButton";
import { watchInstall } from "@andornaut/game-kit/web/pwa/dom/installFlow";
import { describe, expect, it, vi } from "vitest";

import manifest from "../../public/art/manifest.json";
import palette from "../../public/art/palette.json";
import { CHUNKS } from "../data/chunks";
import { TEXT } from "../data/text";
import { RECIPES } from "../data/zones";
import { themesOf } from "../rules/assemble";
import { escaped } from "./actionHelp";
import { homePageHtml, webManifestJson } from "./html";

// The home page and the nav bar are static files, so what they state is checked against the
// game here.
const HOME_PAGE = new URL("../../pages/index.html", import.meta.url);
const NAV_SCRIPT = new URL("../../public/nav.js", import.meta.url);
const WEB_MANIFEST = new URL("../../public/manifest.webmanifest", import.meta.url);

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

it("renders the home page's description into the web app manifest", async () => {
  const text = { ...TEXT, homePage: { ...TEXT.homePage, description: 'A "bird" & <ferret>' } };
  const json = await readFile(WEB_MANIFEST, "utf8");
  expect(JSON.parse(webManifestJson(text, json))).toMatchObject({
    description: 'A "bird" & <ferret>',
  });
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
  it("renders each authored action beside a filled vector control icon", async () => {
    const html = await pageText();
    const controls = /<ul class="keys">(.*?)<\/ul>/u.exec(html)![1]!;
    expect([...controls.matchAll(/<li>/gu)]).toHaveLength(TEXT.homePage.instructions.length);
    for (const action of ["move", "jump", "use"] as const) {
      expect(controls).toContain(`<span>${TEXT.buttons[action]}</span>`);
      expect(controls).toContain(`action-help-${action}`);
      expect(controls).toContain(`fill="${palette.colours.navy}"`);
    }
    expect(controls).toContain('aria-hidden="true"');
    expect(controls).not.toContain("style=");
    expect(controls).not.toMatch(/\{(?:move|jump|use)\}|Keyboard:|KeyE|Space|arrows/iu);
  });
  it("escapes action labels and prose while preserving only renderer-owned markup", async () => {
    const html = homePageHtml(
      {
        ...TEXT,
        buttons: { ...TEXT.buttons, use: "Use <unsafe>" },
        homePage: { ...TEXT.homePage, instructions: ["<script>{use}</script>"] },
      },
      await readFile(HOME_PAGE, "utf8"),
    );
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Use &lt;unsafe&gt;");
    expect(html).toContain("&lt;/script&gt;");
    expect(html).not.toContain("<unsafe>");
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

describe("the home page's install offer", () => {
  const CHROME_DESKTOP =
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
  const KINDS = Object.keys(TEXT.settings.installSteps);

  it("renders a titled data-steps section for every kind from the data", async () => {
    const dialog = /<dialog [^>]*id="install-steps"[^>]*>(.*?)<\/dialog>/u.exec(
      await pageText(),
    )![1]!;
    const pattern =
      /<div data-steps="(\w+)" hidden><h2 id="install-steps-\1">(.*?)<\/h2><p>(.*?)<\/p><\/div>/gu;
    const sections = [...dialog.matchAll(pattern)].map(([, kind, title, steps]) => [
      kind,
      { steps, title },
    ]);
    expect(sections.map(([kind]) => kind)).toEqual([...KINDS].sort());
    expect(Object.fromEntries(sections)).toEqual(
      Object.fromEntries(
        Object.entries(TEXT.settings.installSteps).map(([kind, { steps, title }]) => [
          kind,
          { steps: escaped(steps), title: escaped(title) },
        ]),
      ),
    );
    expect(dialog).not.toContain("data-browser");
  });

  it("shows Install in Chrome without a held prompt and opens the Chrome steps", async () => {
    const host = Object.assign(new EventTarget(), {
      matchMedia: () => ({ matches: false }),
      navigator: { maxTouchPoints: 0, userAgent: CHROME_DESKTOP },
    });
    const sections = KINDS.map((kind) => ({ dataset: { steps: kind }, hidden: true }));
    const dialog = Object.assign(new EventTarget(), {
      close: vi.fn(),
      querySelector: (selector: string) => {
        const kind = /^\[data-steps="(\w+)"\]( h2)?$/u.exec(selector);
        const section = sections.find(({ dataset }) => dataset.steps === kind?.[1]);
        return section === undefined
          ? null
          : kind?.[2]
            ? { id: `install-steps-${kind[1]}` }
            : section;
      },
      querySelectorAll: () => sections,
      setAttribute: vi.fn(),
      showModal: vi.fn(),
    });
    const button = Object.assign(new EventTarget(), { hidden: true });
    wireInstallButton(
      watchInstall(host),
      button as unknown as HTMLElement,
      dialog as unknown as HTMLDialogElement,
    );
    expect(button.hidden).toBe(false);
    button.dispatchEvent(new Event("click"));
    await vi.waitFor(() => expect(dialog.showModal).toHaveBeenCalledOnce());
    expect(sections.filter(({ hidden }) => !hidden).map(({ dataset }) => dataset.steps)).toEqual([
      "chromiumDesktop",
    ]);
    expect(dialog.setAttribute).toHaveBeenCalledWith(
      "aria-labelledby",
      "install-steps-chromiumDesktop",
    );
  });
});
