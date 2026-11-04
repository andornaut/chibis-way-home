/**
 * The art generators' command-line entry. Each generator exports its build and ends with
 *
 *   if (import.meta.main) run(() => commands({ usage: USAGE, build, preview }));
 *
 * or runs pixel.main for a sprite generator. run starts the command after the module graph has
 * loaded, so a build may import a producer that imports its caller (room doors and floor1, the
 * background tones and every backdrop producer) without the top-level await deadlock. This module
 * imports nothing, so any generator, including one pixel.ts loads, can use it.
 */

interface Commands {
  usage: string;
  build?: () => unknown;
  preview?: (out: string) => unknown;
}

const HELP = new Set(["--help", "-h", "help"]);

/**
 * Run argv's `build` or `preview OUT` command. `help`, `-h` or `--help` prints the usage to
 * stdout; any other argv prints it to stderr and exits 2.
 */
export async function commands(
  { build, preview, usage }: Commands,
  argv: readonly string[] = process.argv.slice(2),
): Promise<void> {
  if (argv.length === 1 && HELP.has(argv[0] as string)) {
    console.log(usage);
  } else if (build && argv.length === 1 && argv[0] === "build") {
    await build();
  } else if (preview && argv.length === 2 && argv[0] === "preview") {
    await preview(argv[1] as string);
  } else {
    console.error(usage);
    process.exit(2);
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
