// Deterministic agent traces: a canonical text form for each tick and a compact running hash.
// Equal hashes prove equal per-tick output; a retained trace locates the first divergent tick.

// Names a shared reference (such as a layout object) instead of serializing it again.
export type TraceReference = (value: object) => string | undefined;

const PLAIN = new Set([Object.prototype, null]);

function canonicalNumber(value: number): string {
  return Object.is(value, -0) ? "-0" : Number.isFinite(value) ? String(value) : `"${value}"`;
}

// Keys are sorted and undefined members are omitted, so construction order is not observable.
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
      text = `[${item.map((entry) => (entry === undefined ? "null" : write(entry))).join(",")}]`;
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

// Two independent 32-bit FNV-1a lanes over UTF-16 code units form a 64-bit hex digest.
export function traceRecorder(retain: boolean): TraceRecorder {
  let low = 0x811c9dc5;
  let high = 0x01000193 ^ 0x5bd1e995;
  let ticks = 0;
  const kept: string[] | undefined = retain ? [] : undefined;
  const feed = (code: number) => {
    low = Math.imul(low ^ code, 0x01000193) >>> 0;
    high = Math.imul(high ^ code, 0x01000193 + 0x100) >>> 0;
  };
  return {
    hash: () =>
      `${high.toString(16).padStart(8, "0")}${low.toString(16).padStart(8, "0")}:${ticks}`,
    lines: () => kept,
    record: (line) => {
      for (let index = 0; index < line.length; index++) {
        feed(line.charCodeAt(index));
      }
      feed(10);
      ticks++;
      kept?.push(line);
    },
    ticks: () => ticks,
  };
}
