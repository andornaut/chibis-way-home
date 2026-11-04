import type { ObjectLayout, Point, Rect, Size, SpriteContact } from "../data/types";
import { sweptContact } from "./sweptContact";

const CLOCK_EDGE = 1e-9;
const FRAME_RECTS = new WeakMap<SpriteContact, Readonly<Record<string, readonly Rect[]>>>();
const TIMELINES = new WeakMap<SpriteContact, Readonly<Record<string, readonly number[]>>>();

export function contactFrameAt(
  contact: SpriteContact,
  tag: string,
  seconds: number,
): { readonly frame: string; readonly remaining: number } {
  if (!Number.isFinite(seconds) || seconds < 0) {
    throw new Error("Invalid sprite animation clock");
  }
  let timelines = TIMELINES.get(contact);
  if (!timelines) {
    timelines = Object.fromEntries(
      Object.entries(contact.tags).map(([name, animation]) => {
        let total = 0;
        return [name, animation.frames.map((frame) => (total += frame.seconds))];
      }),
    );
    TIMELINES.set(contact, timelines);
  }
  const animation = contact.tags[tag];
  const ends = timelines[tag];
  if (!animation || !ends?.length) {
    throw new Error(`Missing silhouette animation ${tag}`);
  }
  const total = ends[ends.length - 1] as number;
  const held = animation.once && seconds >= total - CLOCK_EDGE;
  let phase = held ? total : Math.max(0, seconds) % total;
  if (!held && total - phase < CLOCK_EDGE) {
    phase = 0;
  }
  const index = held ? ends.length - 1 : ends.findIndex((end) => phase + CLOCK_EDGE < end);
  const frame = animation.frames[index < 0 ? 0 : index];
  if (!frame) {
    throw new Error(`Missing silhouette frame in ${tag}`);
  }
  return {
    frame: frame.frame,
    remaining: held ? Infinity : (ends[index < 0 ? 0 : index] as number) - phase,
  };
}

// Match native sprite rendering: bottom alignment, centred frame, and rounded world origin.
export function spriteFrameOrigin(
  frame: Size,
  object: Size,
  at: Point,
  scale: Point = { x: 1, y: 1 },
): Point {
  return {
    x: Math.round(at.x + Math.round((object.width - frame.width * scale.x) / 2)),
    y: Math.round(at.y + object.height - frame.height * scale.y),
  };
}

function rectangles(contact: SpriteContact, frame: string): readonly Rect[] {
  let frames = FRAME_RECTS.get(contact);
  if (!frames) {
    frames = Object.fromEntries(
      Object.entries(contact.frames).map(([name, runs]) => {
        const rects: { x: number; y: number; width: number; height: number }[] = [];
        const previous = new Map<string, { x: number; y: number; width: number; height: number }>();
        let row = -2;
        for (const [y, left, right] of runs) {
          if (y !== row) {
            if (y !== row + 1) {
              previous.clear();
            }
            row = y;
          }
          const key = `${left}:${right}`;
          const above = previous.get(key);
          if (above && above.y + above.height === y) {
            above.height++;
          } else {
            const rect = { height: 1, width: right - left, x: left, y };
            rects.push(rect);
            previous.set(key, rect);
          }
        }
        return [name, rects];
      }),
    );
    FRAME_RECTS.set(contact, frames);
  }
  const rects = frames[frame];
  if (!rects) {
    throw new Error(`Missing silhouette pixels for ${frame}`);
  }
  return rects;
}

export function prepareSpriteContact(contact: SpriteContact): SpriteContact {
  const frame = Object.keys(contact.frames)[0];
  const tag = Object.keys(contact.tags)[0];
  if (!frame || !tag) {
    throw new Error("Missing silhouette frames or animations");
  }
  rectangles(contact, frame);
  contactFrameAt(contact, tag, 0);
  return contact;
}

// Sweep each opaque compound rectangle rather than the union of transparent frame padding.
export function silhouetteContact(
  object: ObjectLayout,
  frame: string,
  flipX: boolean,
  from: Point,
  to: Point,
  target: Rect,
  targetEnd: Rect,
  scale: Point = { x: 1, y: 1 },
): boolean {
  const contact = object.contact;
  if (!contact) {
    throw new Error(`Missing silhouette for ${object.art}`);
  }
  const origin = spriteFrameOrigin(contact.frame, object, from, scale);
  const end = spriteFrameOrigin(contact.frame, object, to, scale);
  const broad = {
    ...origin,
    height: contact.frame.height * scale.y,
    width: contact.frame.width * scale.x,
  };
  if (!sweptContact(broad, end, target, targetEnd)) {
    return false;
  }
  return rectangles(contact, frame).some((rect) => {
    const box = {
      height: rect.height * scale.y,
      width: rect.width * scale.x,
      x: origin.x + (flipX ? contact.frame.width - rect.x - rect.width : rect.x) * scale.x,
      y: origin.y + rect.y * scale.y,
    };
    return sweptContact(
      box,
      { x: box.x + end.x - origin.x, y: box.y + end.y - origin.y },
      target,
      targetEnd,
    );
  });
}
