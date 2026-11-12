// @vitest-environment happy-dom
import { readFileSync } from "node:fs";

import { MODAL_DIM } from "@andornaut/game-kit/view/modalDim";
import { afterEach, describe, expect, it } from "vitest";

import palette from "../../../public/art/palette.json" with { type: "json" };
import { createUiLayer, UI_DIMMED, type UiLayer } from "./layer.ts";
import { remappedFrame, skinColours, UI_COLOURS } from "./skin.ts";

// The modal dim of a #rrggbb palette colour, read straight from art's ramp tables: its one-step
// darker target, as many steps as the canvas's dim takes.
function ramp(hex: string): string {
  let colour = hex;
  for (let step = 0; step < MODAL_DIM.rampSteps; step += 1) {
    colour = (palette.darker as Record<string, string>)[colour] ?? colour;
  }
  return colour;
}

const hex = (colour: number) => `#${colour.toString(16).padStart(6, "0")}`;

describe("the dimmed skin", () => {
  it("dims each UI colour down the palette's ramp, as the canvas's dim does", () => {
    const { dimmed, lit } = skinColours(palette);
    const names = UI_COLOURS.map((name) => `--colour-${name}`);
    expect(Object.keys(lit)).toEqual(names);
    expect(Object.keys(dimmed)).toEqual(names);
    for (const name of UI_COLOURS) {
      const colour = palette.colours[name];
      expect([lit[`--colour-${name}`], dimmed[`--colour-${name}`]]).toEqual([colour, ramp(colour)]);
    }
  });

  it("remaps every opaque pixel of a frame down the ramp, keeping its alpha", () => {
    const sources = UI_COLOURS.map((name) => palette.colours[name]);
    // One pixel per UI colour, the last of them clear, in a 2D canvas that keeps its pixels.
    const pixels = new Uint8ClampedArray(
      sources.flatMap((colour, index) => {
        const value = Number.parseInt(colour.slice(1), 16);
        const alpha = index === sources.length - 1 ? 0 : 128 + index;
        return [(value >> 16) & 255, (value >> 8) & 255, value & 255, alpha];
      }),
    );
    let written: Uint8ClampedArray | undefined;
    const context = {
      drawImage: () => {},
      getImageData: () => ({ data: pixels.slice() }),
      putImageData: (image: { data: Uint8ClampedArray }) => {
        written = image.data;
      },
    };
    const stub = {
      createElement: () => ({ getContext: () => context, height: 0, width: 0 }),
    } as unknown as Document;
    const rect = { height: 1, width: sources.length, x: 0, y: 0 };
    const remap = (colour: number) => Number.parseInt(ramp(hex(colour)).slice(1), 16);
    remappedFrame(stub, remap, {} as CanvasImageSource, rect);
    const out = [...Array(sources.length).keys()].map((index) => {
      const [r, g, b, alpha] = written!.slice(index * 4, index * 4 + 4);
      return [hex((r! << 16) | (g! << 8) | b!), alpha];
    });
    expect(out).toEqual(
      sources.map((colour, index) =>
        index === sources.length - 1 ? [colour, 0] : [ramp(colour), 128 + index],
      ),
    );
  });

  it("paints SVG chrome's fills and strokes in each UI colour's custom property", () => {
    const css = readFileSync("src/ui/dom/ui.css", "utf8").replace(/\s+/gu, " ");
    for (const name of UI_COLOURS) {
      for (const paint of ["fill", "stroke"]) {
        expect(css).toContain(`[data-ui-${paint}="${name}"] { ${paint}: var(--colour-${name}); }`);
      }
    }
  });
});

describe("the dim under the top card", () => {
  let layer: UiLayer;
  afterEach(() => layer.dispose());

  // Three scene views in order, the middle one holding the card and a live element, and the
  // lowest holding a live element inside a group beside an image.
  function views() {
    layer = createUiLayer([], document);
    document.body.append(layer.element);
    layer.setDimmedSkin({ "--colour-ink": "#000001", "--ui-button-image": 'url("blob:dim")' });
    const view = (order: number) => {
      const element = document.createElement("div");
      layer.mount(order, element);
      return element;
    };
    const [low, middle, high] = [view(1), view(2), view(3)];
    const group = document.createElement("div");
    const lowLive = document.createElement("button");
    const sibling = document.createElement("span");
    group.append(lowLive, sibling);
    const image = document.createElement("img");
    image.src = "blob:lit";
    layer.dimImage("blob:lit", "blob:dimmed");
    low!.append(group, image);
    const dialog = document.createElement("section");
    const hud = document.createElement("div");
    middle!.append(dialog, hud);
    return { dialog, group, high: high!, hud, image, low: low!, lowLive, middle: middle!, sibling };
  }

  const dimmed = (element: Element) => element.hasAttribute(UI_DIMMED);

  it("dims what lies under the card, apart from its live elements, and lifts it on close", () => {
    const parts = views();
    const close = layer.modals.open({ live: [parts.hud, parts.lowLive] }, parts.dialog);
    expect({
      group: dimmed(parts.group),
      high: dimmed(parts.high),
      hud: dimmed(parts.hud),
      image: [dimmed(parts.image), parts.image.getAttribute("src")],
      low: dimmed(parts.low),
      lowLive: dimmed(parts.lowLive),
      middle: dimmed(parts.middle),
      sibling: [dimmed(parts.sibling), parts.sibling.style.getPropertyValue("--colour-ink")],
    }).toEqual({
      group: false,
      high: false,
      hud: false,
      image: [true, "blob:dimmed"],
      low: false,
      lowLive: false,
      middle: false,
      sibling: [true, "#000001"],
    });
    close();
    expect({
      image: [dimmed(parts.image), parts.image.getAttribute("src")],
      sibling: [dimmed(parts.sibling), parts.sibling.style.getPropertyValue("--colour-ink")],
    }).toEqual({ image: [false, "blob:lit"], sibling: [false, ""] });
  });

  it("dims every view under the card, and only under the top one of a stack", () => {
    const parts = views();
    const closeMiddle = layer.modals.open({}, parts.dialog);
    expect([dimmed(parts.low), dimmed(parts.middle), dimmed(parts.high)]).toEqual([
      true,
      false,
      false,
    ]);
    const card = document.createElement("section");
    parts.high.append(card);
    const closeHigh = layer.modals.open({}, card);
    expect([dimmed(parts.low), dimmed(parts.middle), dimmed(parts.high)]).toEqual([
      true,
      true,
      false,
    ]);
    expect(parts.middle.style.getPropertyValue("--ui-button-image")).toBe('url("blob:dim")');
    closeHigh();
    expect([dimmed(parts.low), dimmed(parts.middle)]).toEqual([true, false]);
    closeMiddle();
    expect(dimmed(parts.low)).toBe(false);
  });

  it("shows the dimmed source of an image given its lit one while it is dimmed", async () => {
    const parts = views();
    layer.modals.open({}, parts.dialog);
    const later = document.createElement("img");
    parts.low.append(later);
    later.src = "blob:lit";
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(later.getAttribute("src")).toBe("blob:dimmed");
  });
});
