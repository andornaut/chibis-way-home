import "./page.css";
import "./viewer.css";

import { sheetTags } from "@andornaut/game-kit/art/aseprite";
import { parseBitmapFont } from "@andornaut/game-kit/text/bitmapFont";

import manifestJson from "../../public/art/manifest.json";
import palette from "../../public/art/palette.json";
import { type ArtManifest } from "../assets";
import { galleryCatalogue, type GalleryItem } from "./catalogue";
import { type Crop, fontPreview, galleryFrame } from "./preview";

const element = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text?: string,
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
};
for (const [key, colour] of Object.entries(palette.colours)) {
  document.documentElement.style.setProperty(`--palette-${key}`, colour);
}
const storageKey = "chibis-way-home.gallery";
let zoom = 3,
  ground: string = palette.colours.ink;
try {
  const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "null");
  if (saved && typeof saved === "object") {
    const prefs = saved as { zoom?: unknown; ground?: unknown };
    if (typeof prefs.zoom === "number" && [1, 2, 3, 4].includes(prefs.zoom)) {
      zoom = prefs.zoom;
    }
    if (
      prefs.ground === "checker" ||
      Object.values(palette.colours).some((colour) => colour === prefs.ground)
    ) {
      ground = String(prefs.ground);
    }
  }
} catch {
  /* Preferences are optional when browser storage is unavailable. */
}
const root = document.querySelector<HTMLElement>("#gallery")!;
const search = document.querySelector<HTMLInputElement>("#gallery-search")!;
const zoomControl = document.querySelector<HTMLSelectElement>("#gallery-zoom")!;
const groundControl = document.querySelector<HTMLSelectElement>("#gallery-ground")!;
const animate = document.querySelector<HTMLInputElement>("#gallery-animate")!;
animate.checked = !matchMedia("(prefers-reduced-motion: reduce)").matches;
zoomControl.value = String(zoom);
for (const [name, colour] of Object.entries(palette.colours)) {
  const option = element("option", name);
  option.value = colour;
  groundControl.append(option);
}
groundControl.value = ground;
const surfaces: HTMLElement[] = [],
  canvases: HTMLCanvasElement[] = [];
const players: { elapsed: number; draw: (elapsed: number) => void }[] = [];
const sections: {
  cards: HTMLElement[];
  section: HTMLElement;
  title: string;
  heading: HTMLElement;
}[] = [];
function appearance(): void {
  for (const surface of surfaces) {
    surface.classList.toggle("checker", ground === "checker");
    surface.style.backgroundColor = ground === "checker" ? "" : ground;
  }
  for (const canvas of canvases) {
    canvas.style.width = `${canvas.width * zoom}px`;
    canvas.style.height = `${canvas.height * zoom}px`;
  }
  try {
    localStorage.setItem(storageKey, JSON.stringify({ ground, zoom }));
  } catch {
    /* Preferences remain in memory. */
  }
}
function surface(): HTMLElement {
  const node = element("div");
  node.className = "gallery-view";
  surfaces.push(node);
  return node;
}
function canvas(width: number, height: number): HTMLCanvasElement {
  const node = element("canvas");
  node.width = width;
  node.height = height;
  canvases.push(node);
  return node;
}
async function image(url: string): Promise<HTMLImageElement> {
  const value = new Image();
  value.src = url;
  await value.decode();
  return value;
}
async function response(url: string): Promise<Response> {
  const result = await fetch(url);
  if (!result.ok) {
    throw new Error(`${url}: HTTP ${result.status}`);
  }
  return result;
}
function crop(
  context: CanvasRenderingContext2D,
  source: HTMLImageElement,
  rect: Crop,
  x = 0,
  y = 0,
): void {
  context.drawImage(source, rect.x, rect.y, rect.w, rect.h, x, y, rect.w, rect.h);
}
async function drawItem(card: HTMLElement, item: GalleryItem): Promise<void> {
  const view = surface();
  card.append(view);
  if (item.kind === "data") {
    const link = element("a", item.json);
    link.href = item.json;
    view.append(link);
    return;
  }
  const source = await image(item.png);
  if (item.kind === "image") {
    const drawing = canvas(source.naturalWidth, source.naturalHeight);
    drawing.getContext("2d")!.drawImage(source, 0, 0);
    view.append(drawing);
  } else if (item.kind === "sprite") {
    const sheet = (await (await response(item.json)).json()) as {
      frames: Record<
        string,
        {
          duration: number;
          frame: Crop;
          rotated: boolean;
          sourceSize: { w: number; h: number };
          spriteSourceSize: Crop;
        }
      >;
      meta: Parameters<typeof sheetTags>[0]["meta"];
    };
    const entries = Object.entries(sheet.frames);
    if (entries.some(([, frame]) => frame.rotated)) {
      throw new Error("Rotated gallery frames are unsupported");
    }
    const drawing = canvas(
      Math.max(...entries.map(([, frame]) => frame.sourceSize.w)),
      Math.max(...entries.map(([, frame]) => frame.sourceSize.h)),
    );
    view.append(drawing);
    const context = drawing.getContext("2d")!;
    const tags = new Map(sheetTags(sheet));
    if (!tags.size) {
      tags.set(
        "all",
        entries.map(([frame, data]) => ({ duration: data.duration, frame })),
      );
    }
    const buttons = element("div");
    buttons.className = "gallery-tags";
    let selected = [...tags.keys()][0]!;
    const player = {
      draw: (elapsed: number) => {
        const frame =
          sheet.frames[galleryFrame(tags.get(selected)!, item.once.includes(selected), elapsed)]!;
        context.clearRect(0, 0, drawing.width, drawing.height);
        crop(context, source, frame.frame, frame.spriteSourceSize.x, frame.spriteSourceSize.y);
      },
      elapsed: 0,
    };
    for (const [name, frames] of tags) {
      const button = element("button", `${name} (${frames.length})`);
      button.type = "button";
      button.setAttribute("aria-pressed", String(name === selected));
      button.addEventListener("click", () => {
        selected = name;
        player.elapsed = 0;
        player.draw(0);
        for (const other of buttons.children) {
          other.setAttribute("aria-pressed", String(other === button));
        }
      });
      buttons.append(button);
    }
    card.append(buttons);
    player.draw(0);
    players.push(player);
    const strip = element("details"),
      stripBody = element("div");
    stripBody.className = "gallery-strip";
    strip.append(element("summary", `${entries.length} frames`), stripBody);
    for (const [, frame] of entries) {
      const frameCanvas = canvas(frame.sourceSize.w, frame.sourceSize.h);
      crop(
        frameCanvas.getContext("2d")!,
        source,
        frame.frame,
        frame.spriteSourceSize.x,
        frame.spriteSourceSize.y,
      );
      stripBody.append(frameCanvas);
    }
    card.append(strip);
  } else {
    const xml = await (await response(item.fnt)).text();
    const font = parseBitmapFont(xml);
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    const crops = new Map(
      [...doc.querySelectorAll("char")].map((node) => {
        const value = (name: string) => Number(node.getAttribute(name));
        return [
          String.fromCodePoint(value("id")),
          { h: value("height"), w: value("width"), x: value("x"), y: value("y") },
        ] as const;
      }),
    );
    const preview = fontPreview(font, (char) => crops.get(char), [
      "Chibi's Way Home",
      "THE QUICK BROWN FOX",
      "the quick brown fox",
      "0123456789 !?+-",
    ]);
    const drawing = canvas(preview.width, preview.height);
    for (const glyph of preview.glyphs) {
      crop(drawing.getContext("2d")!, source, glyph.crop, glyph.x, glyph.y);
    }
    view.append(drawing);
  }
  const link = element("a", item.png);
  link.href = item.png;
  card.append(link);
  const metadata = element("details");
  metadata.append(element("summary", "Metadata"), element("pre", JSON.stringify(item, null, 2)));
  card.append(metadata);
}
function filter(): void {
  const query = search.value.trim().toLowerCase();
  let total = 0;
  for (const group of sections) {
    for (const card of group.cards) {
      card.hidden = !card.dataset.key!.toLowerCase().includes(query);
    }
    const count = group.cards.filter((card) => !card.hidden).length;
    total += count;
    group.section.hidden = count === 0;
    group.heading.textContent = `${group.title} (${count}/${group.cards.length})`;
  }
  document.querySelector<HTMLOutputElement>("#gallery-count")!.value = String(total);
}
for (const group of galleryCatalogue(manifestJson as ArtManifest)) {
  const section = element("section"),
    heading = element("h2", group.title),
    grid = element("div");
  section.id = group.id;
  grid.className = "gallery-grid";
  section.append(heading, grid);
  root.append(section);
  const cards = group.items.map((item) => {
    const card = element("article");
    card.className = "gallery-card";
    card.dataset.key = item.key;
    card.append(element("h3", item.key));
    grid.append(card);
    void drawItem(card, item)
      .then(appearance)
      .catch((error: unknown) => {
        card.append(element("p", String(error)));
      });
    return card;
  });
  sections.push({ cards, heading, section, title: group.title });
}
search.addEventListener("input", filter);
zoomControl.addEventListener("change", () => {
  zoom = Number(zoomControl.value);
  appearance();
});
groundControl.addEventListener("change", () => {
  ground = groundControl.value;
  appearance();
});
let previous = 0,
  frameId = 0;
function tick(now: number): void {
  const delta = previous ? now - previous : 0;
  previous = now;
  if (animate.checked && !document.hidden) {
    for (const player of players) {
      player.elapsed += delta;
      player.draw(player.elapsed);
    }
  }
  frameId = requestAnimationFrame(tick);
}
window.addEventListener("pagehide", () => {
  cancelAnimationFrame(frameId);
  frameId = 0;
  previous = 0;
});
window.addEventListener("pageshow", () => {
  if (!frameId) {
    frameId = requestAnimationFrame(tick);
  }
});
document.addEventListener("visibilitychange", () => {
  previous = 0;
});
appearance();
filter();
frameId = requestAnimationFrame(tick);
