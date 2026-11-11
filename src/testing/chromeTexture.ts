import { vi } from "vitest";

// A CanvasTexture stand-in for the chrome sheets: named frames that record their resizes, and a
// canvas that records its size and paint calls. pixels reads a frame's last painted texel.
export function chromeCanvasTexture(key: string, width: number, height: number) {
  const frames = new Map<
    string,
    { cutHeight: number; cutWidth: number; cutX: number; setSize: ReturnType<typeof vi.fn> }
  >();
  const context = {
    clearRect: vi.fn(),
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData: vi.fn(),
  };
  const texture = {
    add: vi.fn((name: string, _source: number, x: number, _y: number, w: number, h: number) => {
      const frame = {
        cutHeight: h,
        cutWidth: w,
        cutX: x,
        setSize: vi.fn((cutWidth: number, cutHeight: number, cutX: number) =>
          Object.assign(frame, { cutHeight, cutWidth, cutX }),
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
  const pixels = (frame: string, x: number, y: number) => {
    const { cutWidth, cutX } = frames.get(frame)!;
    const calls = context.putImageData.mock.calls as [{ data: Uint8ClampedArray }, number][];
    const [image] = calls.filter((args) => args[1] === cutX).at(-1)!;
    return [...image.data.slice(4 * (y * cutWidth + x), 4 * (y * cutWidth + x) + 4)];
  };
  return Object.assign(texture, { pixels });
}
