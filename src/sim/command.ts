import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

// A command-line mistake: runMain prints it and the usage to stderr and exits 2.
export class UsageError extends Error {}

type OptionTypes = Readonly<Record<string, { readonly type: "boolean" | "string" }>>;
type OptionValues<T extends OptionTypes> = {
  readonly [Name in keyof T]?: T[Name]["type"] extends "boolean" ? boolean : string;
} & { readonly help?: boolean };

// Parses args against options, each named without its leading dashes, plus -h and --help. A
// boolean is set by its presence and cleared by --no-<name>; a string value starting with a dash
// is passed as --name=<value>. An unknown, repeated or empty option or a positional argument is
// a usage error.
export function parseOptions<T extends OptionTypes>(
  options: T,
  args: readonly string[],
): OptionValues<T> {
  let parsed;
  try {
    parsed = parseArgs({
      allowNegative: true,
      args: [...args],
      options: { ...options, help: { short: "h", type: "boolean" } },
      strict: true,
      tokens: true,
    });
  } catch (error) {
    throw new UsageError(error instanceof Error ? error.message : String(error));
  }
  const seen = new Set<string>();
  for (const token of parsed.tokens) {
    if (token.kind !== "option") {
      continue;
    }
    if (seen.has(token.name)) {
      throw new UsageError(`Repeated option --${token.name}`);
    }
    seen.add(token.name);
    if (options[token.name]?.type === "string" && (token.value ?? "").trim() === "") {
      throw new UsageError(`--${token.name} needs a value`);
    }
  }
  return parsed.values as OptionValues<T>;
}

// The number value holds; a usage error names a value that is not a finite number.
export function numberOption(name: string, value: string): number {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new UsageError(`--${name} takes a number, not ${value}`);
  }
  return number;
}

// Value, when it is one of allowed; a usage error names any other value and lists allowed.
export function choiceOption<T extends string>(
  what: string,
  allowed: readonly T[],
  value: string,
): T {
  if (!(allowed as readonly string[]).includes(value)) {
    throw new UsageError(`Unknown ${what} ${value}; allowed: ${allowed.join(", ")}`);
  }
  return value as T;
}

// Runs cli on this process's arguments when moduleUrl is the script Node was started with, and
// exits with the status cli returns. A UsageError prints its message and usage to stderr and
// exits 2; any other error prints only its message, without a stack trace, and exits 1.
export function runMain(
  moduleUrl: string,
  usage: string,
  cli: (args: readonly string[]) => number,
): void {
  const script = process.argv[1];
  if (script === undefined || resolve(script) !== fileURLToPath(moduleUrl)) {
    return;
  }
  try {
    process.exitCode = cli(process.argv.slice(2));
  } catch (error) {
    if (error instanceof UsageError) {
      console.error(`${error.message}\n\n${usage}`);
      process.exitCode = 2;
    } else {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  }
}
