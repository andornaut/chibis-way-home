import { FONT_ROLES } from "../layout/fontRoles";

export const UI_FONT_FAMILY = "Liberation Sans";
export const UI_FONT_RESOURCES = [
  {
    key: FONT_ROLES.body,
    role: "body",
    style: "normal",
    url: "/art/fonts/liberation/LiberationSans-Regular.ttf",
    weight: "400",
  },
  {
    key: FONT_ROLES.heading,
    role: "heading",
    style: "normal",
    url: "/art/fonts/liberation/LiberationSans-Bold.ttf",
    weight: "700",
  },
] as const;

export type UiFontResource = (typeof UI_FONT_RESOURCES)[number];
export interface UiFontFace {
  load(): Promise<unknown>;
}
export interface UiFontPorts {
  createFace(resource: UiFontResource): UiFontFace;
  installFace(face: UiFontFace): void;
  removeFace(face: UiFontFace): void;
}
export interface UiFontSubject {
  readonly font: string;
  readonly sourceMetrics: { readonly baseline: number; readonly size: number };
}
export interface UiTextStyle {
  readonly baseline: number;
  readonly family: string;
  readonly role: UiFontResource["role"];
  readonly size: number;
  readonly style: UiFontResource["style"];
  readonly weight: UiFontResource["weight"];
}

function browserFontPorts(): UiFontPorts {
  const faces = document.fonts;
  return {
    createFace: (resource) =>
      new FontFace(UI_FONT_FAMILY, `url("${resource.url}") format("truetype")`, {
        style: resource.style,
        weight: resource.weight,
      }),
    installFace: (face) => void faces.add(face as FontFace),
    removeFace: (face) => void faces.delete(face as FontFace),
  };
}

// Registration is deferred until both exact faces load; layout remains the bitmap font's.
export function mountUiFonts(ports: UiFontPorts = browserFontPorts()) {
  const installed = new Set<UiFontFace>();
  let disposed = false;
  let ready = false;
  let pending = true;
  let resolveReady!: () => void;
  let rejectReady!: (reason: unknown) => void;
  const disposedError = new Error("UI fonts disposed");
  const fontsReady = new Promise<void>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  const removeInstalled = () => {
    for (const face of installed) {
      ports.removeFace(face);
    }
    installed.clear();
  };
  const fail = (error: unknown) => {
    pending = false;
    removeInstalled();
    rejectReady(error);
  };
  try {
    const faces = UI_FONT_RESOURCES.map((resource) => ports.createFace(resource));
    void Promise.all(faces.map((face) => Promise.resolve().then(() => face.load()))).then(
      () => {
        if (disposed) {
          return;
        }
        try {
          for (const face of faces) {
            installed.add(face);
            ports.installFace(face);
          }
          pending = false;
          ready = true;
          resolveReady();
        } catch (error) {
          fail(error);
        }
      },
      (error) => {
        if (!disposed) {
          fail(error);
        }
      },
    );
  } catch (error) {
    fail(error);
  }
  return {
    destroy(): void {
      if (disposed) {
        return;
      }
      disposed = true;
      removeInstalled();
      if (pending) {
        pending = false;
        rejectReady(disposedError);
      }
    },
    fontsReady,
    textStyle(subject: UiFontSubject): UiTextStyle {
      if (disposed) {
        throw disposedError;
      }
      if (!ready) {
        throw new Error("UI fonts are not ready");
      }
      const resource = UI_FONT_RESOURCES.find(({ key }) => key === subject.font);
      if (!resource) {
        throw new Error(`Unknown UI font ${subject.font}`);
      }
      const { baseline, size } = subject.sourceMetrics;
      if (!Number.isFinite(size) || size <= 0 || !Number.isFinite(baseline)) {
        throw new Error(`Invalid bitmap font metrics for ${subject.font}`);
      }
      return {
        baseline,
        family: UI_FONT_FAMILY,
        role: resource.role,
        size,
        style: resource.style,
        weight: resource.weight,
      };
    },
  };
}
