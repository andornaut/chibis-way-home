// Deterministic agent traces: a canonical text form for each tick and a compact running hash.
// Equal hashes prove equal per-tick output; a retained trace locates the first divergent tick.

// Names a shared reference (such as a layout object) instead of serializing it again.
type TraceReference = (value: object) => string | undefined;

const PLAIN = new Set([Object.prototype, null]);

// Non-JSON values use #-prefixed tags, which no JSON value can produce.
function canonicalNumber(value: number): string {
  if (Number.isNaN(value)) {
    return "#NaN";
  }
  if (!Number.isFinite(value)) {
    return value > 0 ? "#Infinity" : "#-Infinity";
  }
  return Object.is(value, -0) ? "-0" : String(value);
}

// Keys are sorted and undefined members are omitted, so construction order is not observable.
// Undefined array entries and holes are both #undefined.
export function canonicalTrace(reference: TraceReference, value: unknown): string {
  const open = new Set<object>();
  const write = (item: unknown): string => {
    if (item === null) {
      return "null";
    }
    switch (typeof item) {
      case "boolean":
        return item ? "true" : "false";
      case "number":
        return canonicalNumber(item);
      case "string":
        return JSON.stringify(item);
      case "undefined":
        return "#undefined";
      case "object":
        break;
      default:
        throw new Error(`Untraceable ${typeof item} value`);
    }
    const named = reference(item);
    if (named !== undefined) {
      return `@${JSON.stringify(named)}`;
    }
    if (open.has(item)) {
      throw new Error("Cyclic trace value");
    }
    open.add(item);
    let text: string;
    if (Array.isArray(item)) {
      const entries: string[] = [];
      for (let index = 0; index < item.length; index++) {
        entries.push(write(item[index]));
      }
      text = `[${entries.join(",")}]`;
    } else if (PLAIN.has(Object.getPrototypeOf(item))) {
      const record = item as Readonly<Record<string, unknown>>;
      text = `{${Object.keys(record)
        .filter((key) => record[key] !== undefined)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${write(record[key])}`)
        .join(",")}}`;
    } else {
      throw new Error("Untraceable class instance");
    }
    open.delete(item);
    return text;
  };
  return write(value);
}

export interface TraceRecorder {
  readonly hash: () => string;
  readonly lines: () => readonly string[] | undefined;
  readonly record: (line: string) => void;
  readonly ticks: () => number;
}

const HALF = 0x1_0000_0000;
// The 64-bit FNV prime is 2^40 + 0x1b3.
const PRIME_LOW = 0x1b3;

// FNV-1a 64 over UTF-8 bytes, with each 64-bit product computed exactly in 32-bit halves.
function fnv1a64Hasher() {
  let high = 0xcbf29ce4;
  let low = 0x84222325;
  const feed = (byte: number) => {
    low = (low ^ byte) >>> 0;
    const product = low * PRIME_LOW;
    high = (Math.imul(high, PRIME_LOW) + (low << 8) + Math.floor(product / HALF)) >>> 0;
    low = product % HALF;
  };
  return {
    digest: () => `${high.toString(16).padStart(8, "0")}${low.toString(16).padStart(8, "0")}`,
    feed,
    feedText: (text: string) => {
      for (let index = 0; index < text.length; index++) {
        let code = text.charCodeAt(index);
        const next = text.charCodeAt(index + 1);
        if (code >= 0xd800 && code < 0xdc00 && next >= 0xdc00 && next < 0xe000) {
          code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
          index++;
        }
        if (code < 0x80) {
          feed(code);
        } else if (code < 0x800) {
          feed(0xc0 | (code >> 6));
          feed(0x80 | (code & 0x3f));
        } else if (code < 0x10000) {
          feed(0xe0 | (code >> 12));
          feed(0x80 | ((code >> 6) & 0x3f));
          feed(0x80 | (code & 0x3f));
        } else {
          feed(0xf0 | (code >> 18));
          feed(0x80 | ((code >> 12) & 0x3f));
          feed(0x80 | ((code >> 6) & 0x3f));
          feed(0x80 | (code & 0x3f));
        }
      }
    },
  };
}

export function fnv1a64(text: string): string {
  const hasher = fnv1a64Hasher();
  hasher.feedText(text);
  return hasher.digest();
}

// The running digest covers each recorded line followed by a newline byte.
export function traceRecorder({ retain }: { readonly retain: boolean }): TraceRecorder {
  const hasher = fnv1a64Hasher();
  let ticks = 0;
  const kept: string[] | undefined = retain ? [] : undefined;
  return {
    hash: () => `${hasher.digest()}:${ticks}`,
    lines: () => kept,
    record: (line) => {
      hasher.feedText(line);
      hasher.feed(10);
      ticks++;
      kept?.push(line);
    },
    ticks: () => ticks,
  };
}
