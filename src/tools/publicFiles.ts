import type { Plugin } from "vite";

// Public files a build ships though no shipped file names them: the favicon browsers request
// without a link, and the licence that travels with the shipped typefaces.
export const UNNAMED_PUBLIC_FILES: readonly string[] = [
  "/art/fonts/liberation/OFL.txt",
  "/favicon.ico",
];

// Shipped files whose text can name another public file.
const SCANNED_FILE = /\.(?:css|html|js)$/u;
// A root-relative URL opening a quoted string or a CSS url(), up to its query or fragment.
const ROOT_RELATIVE_URL = /["'`(](\/[\w-][^"'`()\s?#]*)/gu;

const decoder = new TextDecoder();

// The root-relative URLs a file's text names, in order without repeats.
export function namedUrls(text: string): string[] {
  return [...new Set(Array.from(text.matchAll(ROOT_RELATIVE_URL), ([, url]) => url as string))];
}

// The public files to ship, by URL: each file the build output's texts name that is in the
// public directory (read gives undefined for any other URL) and not already in the output
// (built), then each one a shipped public text file names in turn, and the unnamed files.
export async function shippedPublicFiles(
  context: {
    readonly built: (url: string) => boolean;
    readonly read: (url: string) => Promise<Uint8Array | undefined>;
  },
  unnamed: readonly string[],
  texts: readonly string[],
): Promise<Map<string, Uint8Array>> {
  const shipped = new Map<string, Uint8Array>();
  const pending = [...unnamed, ...texts.flatMap(namedUrls)];
  while (pending.length > 0) {
    const url = pending.shift() as string;
    if (shipped.has(url) || context.built(url)) {
      continue;
    }
    // Each file's references are known only once it is read, so reads run one at a time.
    // eslint-disable-next-line no-await-in-loop
    const bytes = await context.read(url);
    if (bytes === undefined) {
      if (unnamed.includes(url)) {
        throw new Error(`${url} is not in the public directory`);
      }
      continue;
    }
    shipped.set(url, bytes);
    if (SCANNED_FILE.test(url)) {
      pending.push(...namedUrls(decoder.decode(bytes)));
    }
  }
  return shipped;
}

// In a build that does not copy the public directory, emits the public files the output names
// (shippedPublicFiles), so files only the development server loads stay out of the deployment.
// Runs after the plugins that write pages and emit files, and before the precache reads them.
export function publicFilesPlugin(unnamed: readonly string[]): Plugin {
  return {
    apply: "build",
    enforce: "post",
    generateBundle: {
      async handler(_options, bundle) {
        const { build, publicDir } = this.environment.config;
        if (build.copyPublicDir) {
          this.error("public files: the build must not copy the whole public directory");
        }
        const read = async (url: string) => {
          try {
            return await this.fs.readFile(`${publicDir}${url}`);
          } catch (error) {
            const { code } = error as { readonly code?: string };
            if (code === "EISDIR" || code === "ENOENT" || code === "ENOTDIR") {
              return undefined;
            }
            throw error;
          }
        };
        const texts = Object.values(bundle).flatMap((file) => {
          if (!SCANNED_FILE.test(file.fileName)) {
            return [];
          }
          if (file.type === "chunk") {
            return [file.code];
          }
          return [typeof file.source === "string" ? file.source : decoder.decode(file.source)];
        });
        const built = (url: string) => url.slice(1) in bundle;
        try {
          const files = await shippedPublicFiles({ built, read }, unnamed, texts);
          for (const [url, source] of files) {
            this.emitFile({ fileName: url.slice(1), source, type: "asset" });
          }
        } catch (error) {
          this.error(`public files: ${(error as Error).message}`);
        }
      },
      order: "post",
    },
    name: "chibis-way-home-public-files",
  };
}
