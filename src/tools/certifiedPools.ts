import type { Plugin } from "vite";

import type { CertifiedChunks, CertifiedPool } from "../data/types/index.ts";

// The fields of a certified list the game reads: each entry's id, kind and modules, each arena's
// id and the zone. The hashes and counts the lists record for verification stay in the files.
export function certifiedPool(list: CertifiedChunks): CertifiedPool {
  return {
    arenas: list.arenas.map(({ id }) => ({ id })),
    entries: list.entries.map(({ id, kind, modules }) =>
      modules === undefined ? { id, kind } : { id, kind, modules },
    ),
    zone: list.zone,
  };
}

// In a build, loads each certified list in directory (src/data/certified/<zone>.json) as its
// certifiedPool, so the bundle carries no verification-only fields. Tools and tests, which run
// outside the build, read the whole files.
export function certifiedPoolsPlugin(directory: string): Plugin {
  const decoder = new TextDecoder();
  return {
    apply: "build",
    enforce: "pre",
    async load(id) {
      const name = id.startsWith(`${directory}/`) ? id.slice(directory.length + 1) : "";
      if (!/^[\w-]+\.json$/u.test(name)) {
        return undefined;
      }
      const list = JSON.parse(decoder.decode(await this.fs.readFile(id))) as CertifiedChunks;
      return JSON.stringify(certifiedPool(list));
    },
    name: "chibis-way-home-certified-pools",
  };
}
