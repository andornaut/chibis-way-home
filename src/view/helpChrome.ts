import type { ControlAction } from "../data/types";
import {
  TOUCH_CHROME_FRAME,
  TOUCH_KNOB_FRAME,
  type TouchChromeColours,
  type TouchChromeLayer,
  touchChromeLayers,
} from "./touchChrome";

export interface HelpChromeColours extends TouchChromeColours {
  readonly navy: number;
}

// Help icons share live-control geometry but fill the complete interior with an opaque face.
export function helpChromeLayers(
  colours: HelpChromeColours,
  action: ControlAction,
): readonly TouchChromeLayer[] {
  const [ring, ...marks] = touchChromeLayers(colours, action, "rest", false);
  if (ring?.kind !== "ring") {
    throw new Error("Missing help control ring");
  }
  const layers: TouchChromeLayer[] = [
    { centre: ring.centre, colour: colours.ink, kind: "disc", radius: ring.outer },
    { centre: ring.centre, colour: colours.navy, kind: "disc", radius: ring.inner },
    ...marks,
  ];
  if (action === "move") {
    for (const layer of touchChromeLayers(colours, "knob", "rest", false)) {
      if (layer.kind !== "disc") {
        throw new Error("Unexpected move knob geometry");
      }
      layers.push({
        ...layer,
        centre: {
          x: ring.centre.x + layer.centre.x - TOUCH_KNOB_FRAME / 2,
          y: ring.centre.y + layer.centre.y - TOUCH_KNOB_FRAME / 2,
        },
      });
    }
  }
  return layers;
}

export function helpChromeSvg(
  colours: HelpChromeColours,
  size: number,
  action: ControlAction,
): string {
  const shapes = helpChromeLayers(colours, action)
    .map((layer) => {
      const colour = `#${layer.colour.toString(16).padStart(6, "0")}`;
      if (layer.kind === "rect") {
        const { rect } = layer;
        return [
          `<rect x="${rect.x}" y="${rect.y}" width="${rect.width}"`,
          `height="${rect.height}" fill="${colour}"/>`,
        ].join(" ");
      }
      if (layer.kind === "stroke") {
        const path = layer.path.map(({ x, y }, index) => `${index ? "L" : "M"}${x} ${y}`).join(" ");
        return [
          `<path d="${path}" fill="none" stroke="${colour}"`,
          `stroke-width="${layer.width}" stroke-linecap="round" stroke-linejoin="round"/>`,
        ].join(" ");
      }
      const circle = `cx="${layer.centre.x}" cy="${layer.centre.y}"`;
      return layer.kind === "disc"
        ? `<circle ${circle} r="${layer.radius}" fill="${colour}"/>`
        : [
            `<circle ${circle} r="${(layer.outer + layer.inner) / 2}" fill="none"`,
            `stroke="${colour}" stroke-width="${layer.outer - layer.inner}"/>`,
          ].join(" ");
    })
    .join("");
  return [
    `<svg xmlns="http://www.w3.org/2000/svg"`,
    `viewBox="0 0 ${TOUCH_CHROME_FRAME} ${TOUCH_CHROME_FRAME}" width="${size}" height="${size}"`,
    `aria-hidden="true" focusable="false">${shapes}</svg>`,
  ].join(" ");
}
