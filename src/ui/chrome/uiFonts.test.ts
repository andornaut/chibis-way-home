// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";

import { createUiLayer, loadUiFonts } from "../dom/layer.ts";
import { FONT_METRICS } from "../layout/fontRoles.ts";
import { registerUiFonts, UI_FONT_FAMILY, UI_FONT_RESOURCES } from "./uiFonts.ts";

const layers: ReturnType<typeof createUiLayer>[] = [];
afterEach(() => {
  layers.splice(0).forEach((layer) => layer.dispose());
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function fontsDocument() {
  const document = globalThis.document.implementation.createHTMLDocument();
  const faces: { descriptors: FontFaceDescriptors; family: string; source: string }[] = [];
  vi.stubGlobal(
    "FontFace",
    class {
      constructor(family: string, source: string, descriptors: FontFaceDescriptors) {
        faces.push({ descriptors, family, source });
      }
    },
  );
  const fonts = { add: vi.fn(), load: vi.fn<FontFaceSet["load"]>() };
  Object.defineProperty(document, "fonts", { value: fonts });
  return { document, faces, fonts };
}

it("registers exactly the two former CSS face declarations once per document", () => {
  const { document, faces, fonts } = fontsDocument();
  registerUiFonts(document);
  registerUiFonts(document);
  expect(faces).toEqual([
    {
      descriptors: { display: "block", style: "normal", weight: "400" },
      family: "Liberation Sans",
      source: 'url("/art/fonts/liberation/LiberationSans-Regular.ttf") format("truetype")',
    },
    {
      descriptors: { display: "block", style: "normal", weight: "700" },
      family: "Liberation Sans",
      source: 'url("/art/fonts/liberation/LiberationSans-Bold.ttf") format("truetype")',
    },
  ]);
  expect(fonts.add).toHaveBeenCalledTimes(2);
  expect(fonts.load).not.toHaveBeenCalled();
  const other = globalThis.document.implementation.createHTMLDocument();
  const add = vi.fn();
  Object.defineProperty(other, "fonts", { value: { add } });
  registerUiFonts(other);
  expect(add).toHaveBeenCalledTimes(2);
});

it("registers before Boot font requests and keeps both weights ready across layer recreation", async () => {
  const { document, fonts } = fontsDocument();
  const pending: ((faces: FontFace[]) => void)[] = [];
  fonts.load.mockImplementation(() => {
    expect(fonts.add).toHaveBeenCalledTimes(2);
    return new Promise<FontFace[]>((resolve) => {
      pending.push(resolve);
    });
  });
  const layer = createUiLayer([], document);
  layers.push(layer, createUiLayer([], document));
  expect(fonts.add).toHaveBeenCalledTimes(2);
  expect(layer.element.style.getPropertyValue("--ui-font-family")).toBe('"Liberation Sans"');
  let ready = false;
  const loading = loadUiFonts(document.fonts).then(() => {
    ready = true;
  });
  expect(fonts.load.mock.calls).toEqual([
    [`normal 400 ${FONT_METRICS.body.size}px "${UI_FONT_FAMILY}"`],
    [`normal 700 ${FONT_METRICS.body.size}px "${UI_FONT_FAMILY}"`],
  ]);
  expect(UI_FONT_RESOURCES.map(({ weight }) => weight)).toEqual(["400", "700"]);
  pending[0]!([]);
  await Promise.resolve();
  expect(ready).toBe(false);
  pending[1]!([]);
  await loading;
  expect(ready).toBe(true);
});

it("keeps the existing warning and resolved fallback when a requested face fails", async () => {
  const { document, fonts } = fontsDocument();
  const failure = new Error("Font unavailable");
  fonts.load.mockRejectedValue(failure);
  const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
  layers.push(createUiLayer([], document));
  await expect(loadUiFonts(document.fonts)).resolves.toBeUndefined();
  expect(warning).toHaveBeenCalledExactlyOnceWith("UI fonts failed to load", failure);
});
