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

Install Python 3.12 art dependencies with `python3.12 -m venv .venv-art` and `.venv-art/bin/python -m pip install -r requirements-art.txt`. Run entrypoints with `.venv-art/bin/python -I`, for example `.venv-art/bin/python -I art/tools/fonts.py preview OUT.png`, from the repository root. `requirements-art.txt` pins the published art-kit v0.12.0 GitHub release wheel by SHA256 and Pillow 13.0.0. Installed site packages supply art-kit in isolated mode; no registry, source-vendor or editable fallback is used. Asset and font licences remain unchanged.

Shared sprite previews require Node >=24.21 and installed project npm dependencies (art-kit 0.10 and Skia 4), while retaining the `.venv-art/bin/python -I art/tools/<generator>.py preview OUT.png` command.

- Author raster assets through Python scripts: `art/tools/<set>.py`, each with `build` and `preview OUT.png` commands.
- [art-kit](https://github.com/andornaut/art-kit) provides drawing, outline, frame composition, Aseprite export and font mechanisms. Local `art/tools/pixel.py` and `fonts.py` adapters retain the game palette and ramps, glyph selection, paths, manifest and contact metadata.
- A build writes the Aseprite sources (`art/<set>/<key>.aseprite`) and exports them as PNG plus JSON, with Aseprite tags for animations, to `public/art/sprites/<key>.png` and `.json`.
- Change the script, never the `.aseprite`: a build overwrites it.
- Each script's docstring is its spec: every asset's size, tags, frame timings and placement.
- Art reads game layout and data from the generated export files the game writes, never from `src/`. The export files are in `shared/export/`. Art writes the shared data files the game reads (`lights.json`, `palette.json`).
- Keys are kebab-case, named after what the player sees. Internal names match displayed names.
- Run the relevant art manifest and consumer asset key/tag checks in isolated containers, and format changed Markdown before handoff.

Detailed sprite, font, icon, tile and backdrop formats are in the [export contracts](style-guide.md#export-contracts).

### Asset gallery and tuning reference

The read-only [asset gallery](../pages/art/index.html) at `/art/` includes every entry in the [served manifest](../public/art/manifest.json): backdrops, data, fonts, images, sprites and tilesets. Its DOM/canvas previews use the game palette and game-kit Aseprite/BMFont parsers, with native frames, animation tags, exported timings, once-only playback, zoom and background controls. These controls change only the viewer. The [tuning reference](../pages/tuning/index.html) at `/tuning/` lists searchable values directly from the game's tuning data; it does not create overrides, edit the game or run simulations.

## Review and handoff

Use the [critique checklist](style-guide.md#process-critique-and-revise), native and fractional-scale context, and the [asset handoff contract](style-guide.md#asset-handoff). Change generators rather than their generated sources; preserve unrelated outputs.

## Remaining for the first build

- Any further encounter-specific animation or trap artwork requires an approved behaviour and asset contract.
