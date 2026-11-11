import type { TouchChromeLayer } from "../ui";

// Each SVG shape's geometry and paint, as the chrome layer it draws reads them.
export function svgLayers(svg: SVGSVGElement): readonly TouchChromeLayer[] {
  const number = (shape: Element, name: string) => Number(shape.getAttribute(name));
  const paint = (shape: Element, name: string) =>
    Number.parseInt(shape.getAttribute(name)!.slice(1), 16);
  return [...svg.children].map((shape): TouchChromeLayer => {
    if (shape.tagName === "rect") {
      return {
        colour: paint(shape, "fill"),
        kind: "rect",
        rect: {
          height: number(shape, "height"),
          width: number(shape, "width"),
          x: number(shape, "x"),
          y: number(shape, "y"),
        },
      };
    }
    if (shape.tagName === "path") {
      const points = [...shape.getAttribute("d")!.matchAll(/[ML](\S+) (\S+)/gu)];
      return {
        colour: paint(shape, "stroke"),
        kind: "stroke",
        path: points.map(([, x, y]) => ({ x: Number(x), y: Number(y) })),
        width: number(shape, "stroke-width"),
      };
    }
    const centre = { x: number(shape, "cx"), y: number(shape, "cy") };
    if (shape.getAttribute("fill") !== "none") {
      return { centre, colour: paint(shape, "fill"), kind: "disc", radius: number(shape, "r") };
    }
    const half = number(shape, "stroke-width") / 2;
    return {
      centre,
      colour: paint(shape, "stroke"),
      inner: number(shape, "r") - half,
      kind: "ring",
      outer: number(shape, "r") + half,
    };
  });
}
