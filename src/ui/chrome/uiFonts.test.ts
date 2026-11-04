import { expect, it, vi } from "vitest";

import fontBody from "../../../public/art/fonts/font-body.fnt?raw";
import { FONT_ROLES } from "../layout/fontRoles";
import {
  mountUiFonts,
  UI_FONT_FAMILY,
  UI_FONT_RESOURCES,
  type UiFontFace,
  type UiFontResource,
} from "./uiFonts";

function deferred() {
  let resolve!: () => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<void>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, reject, resolve };
}
function setup() {
  const loads = [deferred(), deferred()] as const;
  const faces = loads.map((load) => ({ load: () => load.promise }));
  const existing: UiFontFace = { load: async () => undefined };
  const installed = new Set([existing]);
  const ports = {
    createFace: vi.fn((resource: UiFontResource) => faces[UI_FONT_RESOURCES.indexOf(resource)]!),
    installFace: vi.fn((face: UiFontFace) => void installed.add(face)),
    removeFace: vi.fn((face: UiFontFace) => void installed.delete(face)),
  };
  return { existing, faces, installed, loads, ports };
}

it("registers both exact faces only after both load, maps source metrics, and removes only owned faces", async () => {
  const { existing, faces, installed, loads, ports } = setup();
  const handle = mountUiFonts(ports);
  const sourceMetrics = {
    baseline: Number(/<common\b[^>]*\bbase="([^"]+)"/.exec(fontBody)![1]),
    size: Number(/<info\b[^>]*\bsize="([^"]+)"/.exec(fontBody)![1]),
  };
  expect(() => handle.textStyle({ font: FONT_ROLES.body, sourceMetrics })).toThrow("not ready");
  loads[0].resolve();
  await Promise.resolve();
  expect(ports.installFace).not.toHaveBeenCalled();
  loads[1].resolve();
  await handle.fontsReady;
  expect(ports.createFace.mock.calls.map(([resource]) => resource)).toEqual(UI_FONT_RESOURCES);
  expect(installed).toEqual(new Set([existing, ...faces]));
  expect(handle.textStyle({ font: FONT_ROLES.body, sourceMetrics })).toEqual({
    ...sourceMetrics,
    family: UI_FONT_FAMILY,
    role: "body",
    style: "normal",
    weight: "400",
  });
  expect(
    handle.textStyle({ font: FONT_ROLES.action, sourceMetrics: { baseline: 29, size: 32 } }),
  ).toMatchObject({ baseline: 29, role: "heading", size: 32, weight: "700" });
  handle.destroy();
  handle.destroy();
  expect(installed).toEqual(new Set([existing]));
  expect(ports.removeFace.mock.calls.map(([face]) => face)).toEqual(faces);
  expect(() => handle.textStyle({ font: FONT_ROLES.body, sourceMetrics })).toThrow("disposed");
});

it("rejects a failed face without installing a partial family", async () => {
  const { existing, installed, loads, ports } = setup();
  const handle = mountUiFonts(ports);
  const failure = new Error("font download failed");
  const rejected = expect(handle.fontsReady).rejects.toBe(failure);
  loads[0].resolve();
  loads[1].reject(failure);
  await rejected;
  expect(ports.installFace).not.toHaveBeenCalled();
  expect(installed).toEqual(new Set([existing]));
  handle.destroy();
});

it("settles disposal before pending loads finish and never activates their late results", async () => {
  const { loads, ports } = setup();
  const handle = mountUiFonts(ports);
  const rejected = expect(handle.fontsReady).rejects.toThrow("disposed");
  handle.destroy();
  await rejected;
  loads.forEach((load) => load.resolve());
  await Promise.all(loads.map((load) => load.promise));
  await Promise.resolve();
  expect(ports.installFace).not.toHaveBeenCalled();
  expect(ports.removeFace).not.toHaveBeenCalled();
});

it("rolls back both owned faces if registration fails without removing another owner's face", async () => {
  const { existing, installed, loads, ports } = setup();
  const failure = new Error("font registration failed");
  ports.installFace.mockImplementation((face) => {
    installed.add(face);
    if (installed.size === 3) {
      throw failure;
    }
  });
  const handle = mountUiFonts(ports);
  const rejected = expect(handle.fontsReady).rejects.toBe(failure);
  loads.forEach((load) => load.resolve());
  await rejected;
  expect(installed).toEqual(new Set([existing]));
  handle.destroy();
});
