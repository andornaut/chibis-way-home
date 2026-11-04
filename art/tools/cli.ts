/**
 * The art generators' command-line entry. Each generator ends with
 *
 *   if (import.meta.main) run(() => commands({ usage: USAGE, build, preview }));
 *
 * or runs pixel.main for a sprite generator. run starts the command after the module graph has
 * loaded, so a build may import a producer that imports its caller (room doors and floor1, the
 * background tones and every backdrop producer) without the top-level await deadlock. This module
 * imports nothing, so any generator, including one pixel.ts loads, can use it.
 */

export interface Commands {
  usage: string;
  build?: () => unknown;
  preview?: (out: string) => unknown;
}

/** Run argv's `build` or `preview OUT` command, or exit 1 with the usage text. */
export async function commands(
  { build, preview, usage }: Commands,
  argv: readonly string[] = process.argv.slice(2),
): Promise<void> {
  if (build && argv.length === 1 && argv[0] === "build") await build();
  else if (preview && argv.length === 2 && argv[0] === "preview") await preview(argv[1] as string);
  else {
    console.error(usage);
    process.exit(1);
  }
}

/** Start main once the calling module has loaded; an error is printed and sets exit code 1. */
export function run(main: () => unknown): void {
  Promise.resolve()
    .then(main)
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
}
