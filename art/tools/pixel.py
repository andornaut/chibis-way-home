"""Game palettes and art export policy over art-kit mechanisms. Run art scripts from the repository root."""

import importlib
import json
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import background_palette
import zone_themes
from art_kit.aseprite import export as export_aseprite
from art_kit.aseprite import lua as aseprite_lua
from art_kit.colour import contrast as hex_contrast
from art_kit.colour import rgb as hex_rgb
from art_kit.frames import flipped as flip_frame
from art_kit.frames import tile_sheet
from art_kit.grid import Grid as SharedGrid

# Endesga 32, by role.
K = {
    "rust": "be4a2f",
    "ochre": "d77643",
    "cream": "ead4aa",
    "tan": "e4a672",
    "brown": "b86f50",
    "dbrown": "733e39",
    "plum": "3e2731",
    "dred": "a22633",
    "red": "e43b44",
    "orange": "f77622",
    "amber": "feae34",
    "yellow": "fee761",
    "green": "63c74d",
    "dgreen": "3e8948",
    "forest": "265c42",
    "teal": "193c3e",
    "blue": "124e89",
    "sky": "0099db",
    "cyan": "2ce8f5",
    "white": "ffffff",
    "lgrey": "c0cbdc",
    "grey": "8b9bb4",
    "slate": "5a6988",
    "dslate": "3a4466",
    "navy": "262b44",
    "ink": "181425",
    "hot": "ff0044",
    "purple": "68386c",
    "mauve": "b55088",
    "pink": "f6757a",
    "skin1": "e8b796",
    "skin2": "c28569",
}
K.update(zone_themes.colours())
K.update(background_palette.colours(K))
K["warning-red"] = "d45253"
PALETTE = list(K.values())
# One ramp step darker for each colour. Shadows and dimming step down this, never blend with black.
DARKER = dict(
    p.split(":")
    for p in [
        "be4a2f:733e39",
        "d77643:be4a2f",
        "ead4aa:e4a672",
        "e4a672:b86f50",
        "b86f50:733e39",
        "733e39:3e2731",
        "3e2731:181425",
        "a22633:3e2731",
        "e43b44:a22633",
        "d45253:a22633",
        "f77622:be4a2f",
        "feae34:f77622",
        "fee761:feae34",
        "63c74d:3e8948",
        "3e8948:265c42",
        "265c42:193c3e",
        "193c3e:181425",
        "124e89:262b44",
        "0099db:124e89",
        "2ce8f5:0099db",
        "ffffff:c0cbdc",
        "c0cbdc:8b9bb4",
        "8b9bb4:5a6988",
        "5a6988:3a4466",
        "3a4466:262b44",
        "262b44:181425",
        "181425:181425",
        "ff0044:a22633",
        "68386c:3e2731",
        "b55088:68386c",
        "f6757a:b55088",
        "e8b796:c28569",
        "c28569:b86f50",
    ]
)
DARKER.update(zone_themes.ramps(K))
DARKER.update(background_palette.ramps(DARKER, K))

MANIFEST = "public/art/manifest.json"
SPRITES = "public/art/sprites"


def hexc(c):
    """A K name or hex string as hex."""
    return K.get(c, c)


def rgb(c):
    return hex_rgb(hexc(c))


def darker(c, steps=1):
    """c stepped down its ramp."""
    c = hexc(c)
    for _ in range(steps):
        c = DARKER[c]
    return c


def contrast(a, b):
    """WCAG contrast ratio of two local palette colours."""
    return hex_contrast(hexc(a), hexc(b))


class Grid(SharedGrid):
    """Bind the game's palette and two-step outline without changing generator call sites."""

    def __init__(self, w=32, h=32):
        super().__init__(K, w, h, edge=lambda colour: darker(colour, 2))

    def outlined(self, edge=None):
        return super().outlined(edge=edge)


TILESETS = "public/art/tilesets"


def write_tileset(key, items, pieces=None, hitboxes=None, size=12, columns=8):
    """Write a tileset: public/art/tilesets/<key>.png, size x size tiles in rows of columns with no spacing or
    margin, and <key>.json beside it, keys sorted:
      {"tileSize": size, "columns": columns,
       "tiles": {"<name>": <index>},                          index = row * columns + column
       "pieces": {"<name>": [[<index>, ...], ...]},           multi-tile pieces, rows of indices, top row first
       "hitboxes": {"<name>": {"x", "y", "width", "height"}}} optional: a hazard-* tile's hit box in pixels within
                                                              its tile, the shape of a sprite's "hitbox"; written
                                                              only when some tile has one. A tile without an entry
                                                              hits its whole cell.
    items is a list of (name, RGBA image of size x size); pieces maps a piece name to rows of tile names. Returns
    the manifest entry."""

    Path(TILESETS).mkdir(parents=True, exist_ok=True)
    im = tile_sheet(size, columns, [tile for _, tile in items])
    im.save(f"{TILESETS}/{key}.png")
    index = {name: i for i, (name, _) in enumerate(items)}
    data = {
        "columns": columns,
        "pieces": {k: [[index[n] for n in row] for row in v] for k, v in (pieces or {}).items()},
        "tileSize": size,
        "tiles": index,
    }
    if hitboxes:
        unknown = set(hitboxes) - set(index)
        if unknown:
            raise AssertionError(f"{key}: hit boxes for tiles it does not have: {sorted(unknown)}")
        data["hitboxes"] = hitboxes
    with Path(f"{TILESETS}/{key}.json").open("w") as f:
        json.dump(data, f, indent=2, sort_keys=True)
        f.write("\n")
    return {"key": key, "png": f"tilesets/{key}.png", "json": f"tilesets/{key}.json"}


def update_manifest(section, entries):
    """Merge entries (dicts with a "key") into the manifest's section (tilesets, backdrops): replace those with the
    same key, keep every other entry, sort by key. Each tool owns its own keys, so several tools can share a
    section; a tool that stops drawing a piece removes its entry by hand."""
    manifest = {}
    if Path(MANIFEST).exists():
        with Path(MANIFEST).open() as f:
            manifest = json.load(f)
    merged = {e["key"]: e for e in manifest.get(section, [])}
    merged.update({e["key"]: e for e in entries})
    manifest[section] = sorted(merged.values(), key=lambda e: e["key"])
    with Path(MANIFEST).open("w") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")


def flipped(frame):
    return flip_frame(frame)


def preview(sprites, out, grounds=("5a6988", "e4a672", "ead4aa"), scale=3, gap=4):
    """Contact sheet: one row per sprite and ground colour, every frame in tag order."""

    executable = shutil.which("node")
    if executable is None:
        raise FileNotFoundError("node")
    subprocess.run(  # noqa: S603  # Fixed local entrypoint and separate arguments, without a shell.
        [executable, str(Path(__file__).with_name("preview.ts")), str(out)],
        input=json.dumps(
            {
                "palette": K,
                "sprites": list(sprites),
                "grounds": list(grounds),
                "background": K["ink"],
                "scale": scale,
                "gap": gap,
            }
        ),
        text=True,
        check=True,
    )


def _lua(tags, out, key, margins=None):
    return aseprite_lua(PALETTE, tags, out, key=key, margins=margins)


def build(sprites, src_dir, slices=None, once=None, hitboxes=None, contacts=()):
    """Write src_dir/<key>.aseprite for every sprite, export it to public/art/sprites/<key>.png + .json
    with its tags, and list it in the manifest. sprites is a list of (key, tags), tags a list of
    (tag, frames, ms). slices maps a key to its nine-slice margins (left, top, right, bottom): the export
    carries them as an Aseprite slice named after the key, and the manifest entry as "slice". once maps a
    key to the tags that play once and hold their last frame; every other tag loops. Every manifest entry
    carries "once", in frame order, [] when nothing plays once. hitboxes maps a key to its hit box
    (x, y, width, height) in frame pixels, for the facing the sprite is drawn in; the manifest entry carries
    it as "hitbox", and only sprites that declare one have it. A box outside the frame fails the build.
    contacts explicitly opts body sprite keys into silhouette contact and refreshes the shared export."""
    slices, once, hitboxes = slices or {}, once or {}, hitboxes or {}
    sprites = list(sprites)
    unknown_contacts = set(contacts) - {key for key, _ in sprites}
    if unknown_contacts:
        raise AssertionError(f"Unknown contact sprites: {sorted(unknown_contacts)}")
    for key, tags in sprites:
        unknown = set(once.get(key, ())) - {t for t, _, _ in tags}
        if unknown:
            raise AssertionError(f"{key}: once names tags it does not have: {sorted(unknown)}")
        if key in hitboxes:
            x, y, w, h = hitboxes[key]
            fh, fw = len(tags[0][1][0]), len(tags[0][1][0][0])
            if not (w > 0 and h > 0 and (x >= 0) and (y >= 0) and (x + w <= fw) and (y + h <= fh)):
                raise AssertionError(f"{key}: hitbox {hitboxes[key]} is not inside its {fw}x{fh} frame")
    unknown = set(hitboxes) - {k for k, _ in sprites}
    if unknown:
        raise AssertionError(f"hitboxes name sprites the script does not draw: {sorted(unknown)}")
    Path(src_dir).mkdir(parents=True, exist_ok=True)
    Path(SPRITES).mkdir(parents=True, exist_ok=True)
    built = {}
    executable = shutil.which("aseprite")
    if executable is None:
        raise FileNotFoundError("aseprite")
    for key, tags in sprites:
        src = f"{src_dir}/{key}.aseprite"
        export_aseprite(
            executable,
            PALETTE,
            tags,
            src,
            f"{SPRITES}/{key}.png",
            f"{SPRITES}/{key}.json",
            key=key,
            margins=slices.get(key),
        )
        built[key] = [t for t, _, _ in tags if t in once.get(key, ())]
    manifest = {}
    if Path(MANIFEST).exists():
        with Path(MANIFEST).open() as f:
            manifest = json.load(f)
    entries = {s["key"]: s for s in manifest.get("sprites", [])}
    for key, once_tags in built.items():
        entries[key] = {"key": key, "png": f"sprites/{key}.png", "json": f"sprites/{key}.json", "once": once_tags}
        if key in slices:
            entries[key]["slice"] = dict(zip(("left", "top", "right", "bottom"), slices[key], strict=False))
        if key in contacts:
            entries[key]["contact"] = "silhouette"
        if key in hitboxes:
            entries[key]["hitbox"] = dict(zip(("x", "y", "width", "height"), hitboxes[key], strict=False))
    manifest["sprites"] = sorted(entries.values(), key=lambda s: s["key"])
    with Path(MANIFEST).open("w") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")
    if contacts:
        build_contacts = importlib.import_module("contact_silhouettes").build

        build_contacts()
    print("built", ", ".join(built))


def main(
    argv,
    sprites,
    src_dir,
    doc,
    grounds=("5a6988", "e4a672", "ead4aa"),
    slices=None,
    once=None,
    hitboxes=None,
    contacts=(),
):
    """The command line every art script shares: `build`, or `preview OUT.png`. A script declares the tags that
    play once as a ONCE dict beside its sprites(), and any hit boxes as a HITBOX dict, and passes them here."""
    if len(argv) == 3 and argv[1] == "preview":
        preview(list(sprites()), argv[2], grounds)
    elif len(argv) == 2 and argv[1] == "build":
        build(list(sprites()), src_dir, slices, once, hitboxes, contacts)
    else:
        sys.exit(doc)
