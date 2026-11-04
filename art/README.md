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

## Pipeline

Generators are TypeScript on [art-kit](https://github.com/andornaut/art-kit)'s public API and run with Node's native type stripping, from the repository root: `node art/tools/<tool>.ts <command>`, for example `node art/tools/palette.ts build` or `node art/tools/fonts.ts preview OUT.png`. Run them in the plain `node:24.21.0` isolated container described in [Developing](../README.md#developing). Asset and font licences remain unchanged.

To bring generator output back to the checkout, run that container from the repository root with every earlier step's stdout sent to stderr (`>&2`) and end its command with the archive below, then pipe it into `tar -xf -` on the host:

```sh
  && node art/tools/<tool>.ts build >&2 \
  && tar -C /tmp/work -cf - public/art' | tar -xf -
```

- Author raster assets through generators: `art/tools/<set>.ts`, each with `build` and `preview OUT.png` commands.
- art-kit provides drawing, outline, frame composition, sprite-sheet and font mechanisms. Local `art/tools/pixel.ts` and `fonts.ts` adapters retain the game palette and ramps, glyph selection, paths, manifest and contact metadata. `cli.ts` is the shared command-line entry, `imageArt.ts` the shared image helpers and `previewText.ts` draws preview labels in the committed body font.
- A build writes each sprite directly as a PNG sheet plus Phaser json-hash data, with frame tags for animations and slices for nine-slice margins, to `public/art/sprites/<key>.png` and `.json`. Frame names are `<key> N.aseprite`, or `<key>.aseprite` for a single frame.
- `node art/tools/build.ts [--check] [SET...]` rebuilds all art, or each named set and every set that needs it. It runs each generator's `build` in the order its `NEEDS` table requires; a full rebuild starts from a manifest that holds only the hand-registered entries, so a key no generator draws disappears. On an unchanged tree it leaves `git status` clean, and `--check` fails, listing the paths, when a rebuild changes or adds a file under `art/`, `public/art/`, `public/favicon.ico` or `public/icons/`. Add each new generator to its `SETS`, with its `NEEDS` when its build reads another set's exports.
- Change the generator, never its output: a build overwrites it.
- `fonts.ts build` copies the Liberation TTFs and licence from `art/fonts/liberation/` to `public/art/fonts/liberation/`; replace them only in `art/`.
- Each generator's header comment is its spec: every asset's size, tags, frame timings and placement.
- Generators never import or read `src/`. Art writes the data files the game reads: `contact-silhouettes.json`, `palette.json` and `zone-themes.json`, registered under `data` in the manifest.
- Keys are kebab-case, named after what the player sees. Internal names match displayed names.
- Run the relevant art manifest and consumer asset key/tag checks in isolated containers, and format changed Markdown before handoff.

Detailed sprite, font, icon, tile and backdrop formats are in the [export contracts](style-guide.md#export-contracts).

### Asset gallery and tuning reference

The read-only [asset gallery](../pages/art/index.html) at `/art/` includes every entry in the [served manifest](../public/art/manifest.json): backdrops, data, fonts, images, sprites and tilesets. Its DOM/canvas previews use the game palette and game-kit Aseprite/BMFont parsers, with native frames, animation tags, exported timings, once-only playback, zoom and background controls. These controls change only the viewer. The [tuning reference](../pages/tuning/index.html) at `/tuning/` lists searchable values directly from the game's tuning data; it does not create overrides, edit the game or run simulations.

## Review and handoff

Use the [critique checklist](style-guide.md#process-critique-and-revise), native and fractional-scale context, and the [asset handoff contract](style-guide.md#asset-handoff). Change generators rather than their outputs; preserve unrelated outputs.

## Remaining for the first build

- Any further encounter-specific animation or trap artwork requires an approved behaviour and asset contract.
