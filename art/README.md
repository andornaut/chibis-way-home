# Art

Chibi's Way Home artwork, drawing pipeline and remaining art work. The [style guide](style-guide.md) owns appearance, characters, environments and animation.

| Document                      | Owns                                                                   |
| ----------------------------- | ---------------------------------------------------------------------- |
| [Controls](controls.md)       | Control roles, states, interaction and visible-face label alignment    |
| [Inventory](inventory.md)     | Every served asset: key, type, size and tags                           |
| [Layout](layout.md)           | Shared spacing, content fitting and press-target clearance             |
| [Style guide](style-guide.md) | Visual rules, scene compositions, asset contracts and review checklist |

## Scope

- `art/`: generator scripts, font sources and art documentation.
- `public/art/`: served sprites, images, fonts, palette, manifest and contact metadata. The art pipeline also supplies the app and favicon assets in `public/icons/` and `public/`.

Start, Map, Opening, room gift/helper and placeholder Celebration interfaces use the HTML UI layer, reusing the exported frames, palette, Chibi Sans WOFF2 faces and native glyphs. Backgrounds and world art stay on canvas, including map paths, regional miniatures and the travelling bird, opening actors and the room cast. Live Move, Use and Jump controls and the movement knob use decorative SVG on the same HTML layer; stage progress is a separate DOM strip. Their existing input geometry remains unchanged. Generator previews retain a private body BMFont; runtime UI does not load bitmap-font exports.

## Pipeline

Generators are TypeScript on [art-kit](https://github.com/andornaut/art-kit)'s public API and run with Node's native type stripping, from the repository root: `node art/tools/<tool>.ts <command>`, for example `node art/tools/palette.ts build` or `node art/tools/fonts.ts preview OUT.png`. Run them in the plain `node:24.22.2` isolated container described in [Developing](../README.md#developing). Asset and font licences remain unchanged.

To bring generator output back to the checkout, run that container from the repository root with every earlier step's stdout sent to stderr (`>&2`) and end its command with the archive below, then pipe it into `tar -xf -` on the host:

```sh
  && node art/tools/<tool>.ts build >&2 \
  && tar -C /tmp/work -cf - public/art' | tar -xf -
```

- Author raster assets through generators: `art/tools/<set>.ts`, each with `build` and `preview OUT.png` commands.
- art-kit provides drawing, outline, frame composition, sprite-sheet and font mechanisms. Local `art/tools/pixel.ts` and `fonts.ts` adapters retain the game palette and ramps, glyph selection, paths, manifest and contact metadata. `cli.ts` is the shared command-line entry, `imageArt.ts` the shared image helpers and `previewText.ts` draws preview labels in the committed body font.
- A build writes each sprite directly as a PNG sheet plus Phaser json-hash data, with frame tags for animations and slices for nine-slice margins, to `public/art/sprites/<key>.png` and `.json`. Frame names are `<key> N.aseprite`, or `<key>.aseprite` for a single frame.
- `node art/tools/build.ts [--check] [SET...]` rebuilds all art, or each named set and every set that needs it, on art-kit's `build` runner. It runs each generator's `build` in its own process, after the sets its `NEEDS` entry names; a full rebuild starts from a manifest that holds only the hand-registered entries, so a key no generator draws disappears. On an unchanged tree it leaves `git status` clean, and `--check` hashes every file under `art/`, `public/art/`, `public/favicon.ico` and `public/icons/` before the rebuild and fails, listing the paths, when the rebuild changes, removes or adds one; it needs no git, so it runs in a copy without `.git`. `--help` or `-h` prints the usage. It exits 0 on success or help, 1 for a failing build, check differences, a module in `art/tools/` missing from both `SETS` and `NOT_SETS`, a listed module that does not exist or a set declared before a set it needs, and 2 for an unknown option or set. Add each new generator to its `SETS`, after the sets it needs, with its `OUTPUTS` and, when its build reads another set's exports, its `NEEDS`.
- Each set declares its outputs in `build.ts` `OUTPUTS`: every file its build writes under the check paths. `STATIC` lists the hand-kept paths no generator writes (art documentation, font sources and generator sources), plus the stage previews registered by hand in the committed manifest. `--check` also fails on any file under the check paths that no set's outputs and no static entry claims, listed as `!` and the path; every set's outputs count, selected or not.
- Change the generator, never its output: a build overwrites it.
- `fonts.ts build` writes the private preview-label body bitmap font to `art/generated/fonts/font-body.png` and `.fnt`, copies the Liberation licence from `art/fonts/liberation/` to `public/art/fonts/chibi-sans/` and subsets the Regular and Bold source TTFs to the Chibi Sans WOFF2 faces `ChibiSans-Regular.woff2` and `ChibiSans-Bold.woff2` there; the TTFs are not served. Replace the source fonts only in `art/`. Each face keeps the code points of `playerCodePoints()` plus printable ASCII (U+0020 to U+007E), so a changed player string changes the faces and `build.ts --check` fails until they are rebuilt. A subset is a Modified Version, which the SIL OFL 1.1 bars from the Reserved Font Names Arimo, Cousine, Liberation and Tinos, so the subsets carry Chibi Sans family, unique, full and PostScript names and keep the copyright and licence records. It subsets through the published `@andornaut/art-kit/build/woff2` `subsetWoff2` API, with art-kit's optional `harfbuzzjs` and `wawoff2` peers installed. `previewText.ts` deterministically builds its body font before reading it, so standalone previews do not depend on served bitmap fonts. The runtime manifest has no bitmap-font entries.
- Each generator's header comment is its spec: every asset's size, tags, frame timings and placement.
- Generators may import the canonical data-only `TILE` from `src/data/screen.ts`, `ROOM_BUILDING_OPENING` from `src/data/roomBuildings.ts`, and `CONTROL_DISC_FRAME`, `MENU_GLYPH` and `PAUSE_GLYPH` from `src/data/layout.ts` to derive tile, opening and control-glyph geometry, and `fonts.ts` imports `playerCodePoints` from `src/ui/chrome/uiFontCodePoints.ts` to derive the font subset. Other `src/` imports and runtime, scene or Phaser dependencies remain excluded. Game-specific art definitions, palettes and manifest policy stay in the client. Art writes the data files the game reads: `contact-silhouettes.json`, `palette.json` and `zone-themes.json`, registered under `data` in the manifest.
- Keys are kebab-case, named after what the player sees. Internal names match displayed names.
- Run the relevant art manifest and consumer asset key/tag checks in isolated containers, and format changed Markdown before handoff.

Detailed sprite, font, icon, tile and backdrop formats are in the [export contracts](style-guide.md#export-contracts).

### Asset gallery and tuning reference

The read-only [asset gallery](../pages/art/index.html) at `/art/` includes every entry in the [served manifest](../public/art/manifest.json): backdrops, data, fonts, images, sprites and tilesets. Its DOM/canvas previews use the game palette and game-kit Aseprite/BMFont parsers, with native frames, animation tags, exported timings, once-only playback, zoom and background controls. These controls change only the viewer. The [tuning reference](../pages/tuning/index.html) at `/tuning/` lists searchable values directly from the game's tuning data; it does not create overrides, edit the game or run simulations.

## Review and handoff

Use the [critique checklist](style-guide.md#process-critique-and-revise), native and fractional-scale context, and the [asset handoff contract](style-guide.md#asset-handoff). Change generators rather than their outputs; preserve unrelated outputs.

## Remaining for the first build

- Any further encounter-specific animation or trap artwork requires an approved behaviour and asset contract.
