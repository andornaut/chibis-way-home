# Art

Chibi's Way Home artwork, drawing pipeline and remaining art work. The [style guide](style-guide.md) owns appearance, characters, environments and animation.

| Document                             | Owns                                                                   |
| ------------------------------------ | ---------------------------------------------------------------------- |
| [Controls](controls.md)              | Control roles, states, interaction and visible-face label alignment    |
| [Inventory](inventory.md)            | Every served asset: key, type, size and tags                           |
| [Layout](layout.md)                  | Shared spacing, content fitting and press-target clearance             |
| [Opening artwork](opening/README.md) | Retained painted opening assets and their contract                     |
| [Style guide](style-guide.md)        | Visual rules, scene compositions, asset contracts and review checklist |

## Scope

- `art/`: generator scripts, authored Aseprite sources and art documentation.
- `public/art/`: served sprites, images, fonts, palette, manifest and contact metadata. The art pipeline also supplies the app and favicon assets in `public/icons/` and `public/`.

## Pipeline

Generators are TypeScript on [art-kit](https://github.com/andornaut/art-kit)'s public API and run with Node's native type stripping, from the repository root: `node art/tools/<tool>.ts <command>`, for example `node art/tools/palette.ts build` or `node art/tools/fonts.ts preview OUT.png`. Run them in the isolated container described in [Developing](../README.md#developing); builds that export Aseprite sprites use its `chibi-check:node24.21.0-aseprite1.2.30` image. Asset and font licences remain unchanged.

- Author raster assets through generators: `art/tools/<set>.ts`, each with `build` and `preview OUT.png` commands.
- art-kit provides drawing, outline, frame composition, Aseprite export and font mechanisms. Local `art/tools/pixel.ts` and `fonts.ts` adapters retain the game palette and ramps, glyph selection, paths, manifest and contact metadata. `cli.ts` is the shared command-line entry, `imageArt.ts` the shared image helpers and `previewText.ts` draws preview labels in the committed body font.
- A build writes the Aseprite sources (`art/<set>/<key>.aseprite`) and exports them as PNG plus JSON, with Aseprite tags for animations, to `public/art/sprites/<key>.png` and `.json`.
- Change the generator, never the `.aseprite`: a build overwrites it.
- Each generator's header comment is its spec: every asset's size, tags, frame timings and placement.
- Generators never import or read `src/`. Art writes the data files the game reads: `contact-silhouettes.json`, `palette.json` and `zone-themes.json`, registered under `data` in the manifest.
- Keys are kebab-case, named after what the player sees. Internal names match displayed names.
- Run the relevant art manifest and consumer asset key/tag checks in isolated containers, and format changed Markdown before handoff.

Detailed sprite, font, icon, tile and backdrop formats are in the [export contracts](style-guide.md#export-contracts).

### Asset gallery and tuning reference

The read-only [asset gallery](../pages/art/index.html) at `/art/` includes every entry in the [served manifest](../public/art/manifest.json): backdrops, data, fonts, images, sprites and tilesets. Its DOM/canvas previews use the game palette and game-kit Aseprite/BMFont parsers, with native frames, animation tags, exported timings, once-only playback, zoom and background controls. These controls change only the viewer. The [tuning reference](../pages/tuning/index.html) at `/tuning/` lists searchable values directly from the game's tuning data; it does not create overrides, edit the game or run simulations.

## Review and handoff

Use the [critique checklist](style-guide.md#process-critique-and-revise), native and fractional-scale context, and the [asset handoff contract](style-guide.md#asset-handoff). Change generators rather than their generated sources; preserve unrelated outputs.

## Remaining for the first build

- Any further encounter-specific animation or trap artwork requires an approved behaviour and asset contract.
