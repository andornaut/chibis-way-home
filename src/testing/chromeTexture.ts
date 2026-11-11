import { vi } from "vitest";

// A CanvasTexture stand-in for the chrome sheets: named frames that record their resizes, and a
// canvas that records its size and paint calls.
export function chromeCanvasTexture(key: string, width: number, height: number) {
  const frames = new Map<
    string,
    { cutHeight: number; cutWidth: number; setSize: ReturnType<typeof vi.fn> }
  >();
  const context = {
    clearRect: vi.fn(),
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData: vi.fn(),
  };
  const texture = {
    add: vi.fn((name: string, _source: number, _x: number, _y: number, w: number, h: number) => {
      const frame = {
        cutHeight: h,
        cutWidth: w,
        setSize: vi.fn((cutWidth: number, cutHeight: number) =>
          Object.assign(frame, { cutHeight, cutWidth }),
        ),
      };
      frames.set(name, frame);
      return frame;
    }),
    frames,
    get: (name: string) => frames.get(name),
    getContext: () => context,
    has: (name: string) => frames.has(name),
    height,
    key,
    refresh: vi.fn(),
    setFilter: vi.fn(),
    setSize: vi.fn((w: number, h: number) => Object.assign(texture, { height: h, width: w })),
    width,
  };
  return texture;
}
