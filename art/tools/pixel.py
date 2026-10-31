"""Shared pixel-art tooling: the Endesga 32 palette and its ramps, a drawing grid with cel shading and
coloured outlines, a contact-sheet preview, and the step that turns frames into an Aseprite source, a
PNG + JSON export and a manifest entry. Run the art scripts from the repository root."""

import json
import os
import subprocess
import sys
import tempfile

import zone_themes

# Endesga 32, by role.
K = dict(
    rust="be4a2f", ochre="d77643", cream="ead4aa", tan="e4a672", brown="b86f50", dbrown="733e39", plum="3e2731",
    dred="a22633", red="e43b44", orange="f77622", amber="feae34", yellow="fee761", green="63c74d", dgreen="3e8948",
    forest="265c42", teal="193c3e", blue="124e89", sky="0099db", cyan="2ce8f5", white="ffffff", lgrey="c0cbdc",
    grey="8b9bb4", slate="5a6988", dslate="3a4466", navy="262b44", ink="181425", hot="ff0044", purple="68386c",
    mauve="b55088", pink="f6757a", skin1="e8b796", skin2="c28569",
)
K.update(zone_themes.colours())
PALETTE = list(K.values())
# One ramp step darker for each colour. Shadows and dimming step down this, never blend with black.
DARKER = dict(p.split(":") for p in (
    "be4a2f:733e39 d77643:be4a2f ead4aa:e4a672 e4a672:b86f50 b86f50:733e39 733e39:3e2731 3e2731:181425 "
    "a22633:3e2731 e43b44:a22633 f77622:be4a2f feae34:f77622 fee761:feae34 63c74d:3e8948 3e8948:265c42 "
    "265c42:193c3e 193c3e:181425 124e89:262b44 0099db:124e89 2ce8f5:0099db ffffff:c0cbdc c0cbdc:8b9bb4 "
    "8b9bb4:5a6988 5a6988:3a4466 3a4466:262b44 262b44:181425 181425:181425 ff0044:a22633 68386c:3e2731 "
    "b55088:68386c f6757a:b55088 e8b796:c28569 c28569:b86f50"
).split())
DARKER.update(zone_themes.ramps(K))

MANIFEST = "public/art/manifest.json"
SPRITES = "public/art/sprites"


def hexc(c):
    """A K name or hex string as hex."""
    return K.get(c, c)


def rgb(c):
    c = hexc(c)
    return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))


def darker(c, steps=1):
    """c stepped down its ramp."""
    c = hexc(c)
    for _ in range(steps):
        c = DARKER[c]
    return c


def contrast(a, b):
    """WCAG contrast ratio of two colours."""
    def lum(c):
        v = [x / 255 for x in rgb(c)]
        v = [x / 12.92 if x <= 0.03928 else ((x + 0.055) / 1.055) ** 2.4 for x in v]
        return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]

    la, lb = lum(a), lum(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


class Grid:
    """One frame. Draw fills, then outlined() adds a coloured outline."""

    def __init__(self, w=32, h=32):
        self.w, self.h = w, h
        self.px = [[None] * w for _ in range(h)]

    def p(self, x, y, c):
        x, y = int(x), int(y)
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[y][x] = hexc(c) if c else None

    def rect(self, x, y, w, h, c):
        for j in range(h):
            for i in range(w):
                self.p(x + i, y + j, c)

    def line(self, x0, y0, x1, y1, c):
        """A 1px line (Bresenham)."""
        dx, dy = abs(x1 - x0), -abs(y1 - y0)
        sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
        err = dx + dy
        while True:
            self.p(x0, y0, c)
            if (x0, y0) == (x1, y1):
                return
            e2 = 2 * err
            if e2 >= dy:
                err += dy
                x0 += sx
            if e2 <= dx:
                err += dx
                y0 += sy

    def ell(self, cx, cy, rx, ry, c, sh=None, li=None):
        """Filled ellipse, cel-shaded from a top-left light: sh on the lower-right rim, li on the upper-left."""
        for y in range(self.h):
            for x in range(self.w):
                dx, dy = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
                if dx * dx + dy * dy <= 1:
                    d = 0.7 * (dx + dy)
                    self.p(x, y, sh if sh and d > 0.5 else li if li and d < -0.72 else c)

    def blob(self, cx, cy, rx, ry, c, sh=None, li=None, power=2.6):
        """A squarer oval (superellipse): rounded, but fuller at the top and sides than ell."""
        for y in range(self.h):
            for x in range(self.w):
                dx, dy = abs(x + 0.5 - cx) / rx, abs(y + 0.5 - cy) / ry
                if dx ** power + dy ** power <= 1:
                    d = 0.7 * ((x + 0.5 - cx) / rx + (y + 0.5 - cy) / ry)
                    self.p(x, y, sh if sh and d > 0.5 else li if li and d < -0.72 else c)

    def tri(self, a, b, c, col):
        def side(px, py, x1, y1, x2, y2):
            return (px - x2) * (y1 - y2) - (x1 - x2) * (py - y2)

        for y in range(self.h):
            for x in range(self.w):
                px, py = x + 0.5, y + 0.5
                d1, d2, d3 = side(px, py, *a, *b), side(px, py, *b, *c), side(px, py, *c, *a)
                if not ((d1 < 0 or d2 < 0 or d3 < 0) and (d1 > 0 or d2 > 0 or d3 > 0)):
                    self.p(x, y, col)

    def outlined(self, edge=None):
        """A copy with a coloured outline: each empty pixel touching the sprite takes edge(fill), by default
        the fill two ramp steps darker."""
        out = [row[:] for row in self.px]
        for y in range(self.h):
            for x in range(self.w):
                if self.px[y][x]:
                    continue
                for dx, dy in ((0, -1), (0, 1), (-1, 0), (1, 0)):
                    xx, yy = x + dx, y + dy
                    if 0 <= xx < self.w and 0 <= yy < self.h and self.px[yy][xx]:
                        c = self.px[yy][xx]
                        out[y][x] = edge(c) if edge else darker(c, 2)
                        break
        return out


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
    from PIL import Image

    os.makedirs(TILESETS, exist_ok=True)
    rows = -(-len(items) // columns)
    im = Image.new("RGBA", (columns * size, rows * size), (0, 0, 0, 0))
    for i, (_, tile) in enumerate(items):
        im.alpha_composite(tile, ((i % columns) * size, (i // columns) * size))
    im.save(f"{TILESETS}/{key}.png")
    index = {name: i for i, (name, _) in enumerate(items)}
    data = {"columns": columns, "pieces": {k: [[index[n] for n in row] for row in v] for k, v in (pieces or {}).items()},
            "tileSize": size, "tiles": index}
    if hitboxes:
        unknown = set(hitboxes) - set(index)
        assert not unknown, f"{key}: hit boxes for tiles it does not have: {sorted(unknown)}"
        data["hitboxes"] = hitboxes
    with open(f"{TILESETS}/{key}.json", "w") as f:
        json.dump(data, f, indent=2, sort_keys=True)
        f.write("\n")
    return {"key": key, "png": f"tilesets/{key}.png", "json": f"tilesets/{key}.json"}


def update_manifest(section, entries):
    """Merge entries (dicts with a "key") into the manifest's section (tilesets, backdrops): replace those with the
    same key, keep every other entry, sort by key. Each tool owns its own keys, so several tools can share a
    section; a tool that stops drawing a piece removes its entry by hand."""
    manifest = {}
    if os.path.exists(MANIFEST):
        with open(MANIFEST) as f:
            manifest = json.load(f)
    merged = {e["key"]: e for e in manifest.get(section, [])}
    merged.update({e["key"]: e for e in entries})
    manifest[section] = sorted(merged.values(), key=lambda e: e["key"])
    with open(MANIFEST, "w") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")


def flipped(frame):
    """A frame mirrored left to right."""
    return [row[::-1] for row in frame]


def preview(sprites, out, grounds=("5a6988", "e4a672", "ead4aa"), scale=3, gap=4):
    """Contact sheet: one row per sprite and ground colour, every frame in tag order."""
    from PIL import Image

    rows = []
    for _, tags in sprites:
        frames = [f for _, fs, _ in tags for f in fs]
        for ground in grounds:
            rows.append((frames, ground))
    cell_w = max(len(f[0][0]) for f, _ in rows) + gap
    cell_h = [len(f[0]) + gap for f, _ in rows]
    width = max(len(f) for f, _ in rows) * cell_w * scale
    img = Image.new("RGB", (width, sum(cell_h) * scale), rgb("ink"))
    y0 = 0
    for (frames, ground), ch in zip(rows, cell_h):
        for i, f in enumerate(frames):
            for y, row in enumerate(f):
                for x, c in enumerate(row):
                    img.paste(rgb(c or ground), ((i * cell_w + x) * scale, (y0 + y) * scale,
                                                 (i * cell_w + x + 1) * scale, (y0 + y + 1) * scale))
        y0 += ch
    img.save(out)


LUA = """
local spr = Sprite({w}, {h}, ColorMode.RGB)
local pal = Palette({ncolors})
{palette}
spr:setPalette(pal)
local rgba = app.pixelColor.rgba
local frames = {frames}
local durations = {durations}
for i, px in ipairs(frames) do
  if i > 1 then spr:newFrame() end
  local img = spr.layers[1]:cel(i).image
  img:clear()
  for _, p in ipairs(px) do img:drawPixel(p[1], p[2], rgba(p[3], p[4], p[5], 255)) end
  spr.frames[i].duration = durations[i]
end
{tags}
{slice}
spr:saveAs("{out}")
"""


def _lua(tags, out, key, margins=None):
    frames, durations, tag_lines, n = [], [], [], 0
    h, w = len(tags[0][1][0]), len(tags[0][1][0][0])
    for tag, fs, ms in tags:
        tag_lines.append(f'do local t = spr:newTag({n + 1}, {n + len(fs)}); t.name = "{tag}" end')
        # ms is the tag's frame duration, or a list with one duration per frame
        for f, d in zip(fs, ms if isinstance(ms, (list, tuple)) else [ms] * len(fs)):
            pts = []
            for y, row in enumerate(f):
                for x, c in enumerate(row):
                    if c:
                        r, g, b = rgb(c)
                        pts.append("{%d,%d,%d,%d,%d}" % (x, y, r, g, b))
            frames.append("{" + ",".join(pts) + "}")
            durations.append(str(d / 1000))
        n += len(fs)
    palette = "\n".join(
        "pal:setColor(%d, Color{ r = %d, g = %d, b = %d })" % ((i,) + rgb(c)) for i, c in enumerate(PALETTE)
    )
    slice_lines = ""
    if margins:
        left, top, right, bottom = margins
        slice_lines = (f'do local s = spr:newSlice(Rectangle(0, 0, {w}, {h})); s.name = "{key}"; '
                       f's.center = Rectangle({left}, {top}, {w - left - right}, {h - top - bottom}) end')
    return LUA.format(w=w, h=h, ncolors=len(PALETTE), palette=palette, frames="{" + ",\n".join(frames) + "}",
                      durations="{" + ",".join(durations) + "}", tags="\n".join(tag_lines), slice=slice_lines,
                      out=out)


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
    assert not unknown_contacts, f"Unknown contact sprites: {sorted(unknown_contacts)}"
    for key, tags in sprites:
        unknown = set(once.get(key, ())) - {t for t, _, _ in tags}
        assert not unknown, f"{key}: once names tags it does not have: {sorted(unknown)}"
        if key in hitboxes:
            x, y, w, h = hitboxes[key]
            fh, fw = len(tags[0][1][0]), len(tags[0][1][0][0])
            assert w > 0 and h > 0 and x >= 0 and y >= 0 and x + w <= fw and y + h <= fh, \
                f"{key}: hitbox {hitboxes[key]} is not inside its {fw}x{fh} frame"
    unknown = set(hitboxes) - {k for k, _ in sprites}
    assert not unknown, f"hitboxes name sprites the script does not draw: {sorted(unknown)}"
    os.makedirs(src_dir, exist_ok=True)
    os.makedirs(SPRITES, exist_ok=True)
    built = {}
    for key, tags in sprites:
        src = f"{src_dir}/{key}.aseprite"
        with tempfile.NamedTemporaryFile("w", suffix=".lua", delete=False) as f:
            f.write(_lua(tags, src, key, slices.get(key)))
        subprocess.run(["aseprite", "-b", "--script", f.name], check=True)
        os.unlink(f.name)
        subprocess.run(["aseprite", "-b", src, "--sheet", f"{SPRITES}/{key}.png", "--data", f"{SPRITES}/{key}.json",
                        "--format", "json-hash", "--list-tags"] + (["--list-slices"] if key in slices else []),
                       check=True, stdout=subprocess.DEVNULL)
        built[key] = [t for t, _, _ in tags if t in once.get(key, ())]
    manifest = {}
    if os.path.exists(MANIFEST):
        with open(MANIFEST) as f:
            manifest = json.load(f)
    entries = {s["key"]: s for s in manifest.get("sprites", [])}
    for key in built:
        entries[key] = {"key": key, "png": f"sprites/{key}.png", "json": f"sprites/{key}.json",
                        "once": built[key]}
        if key in slices:
            entries[key]["slice"] = dict(zip(("left", "top", "right", "bottom"), slices[key]))
        if key in contacts:
            entries[key]["contact"] = "silhouette"
        if key in hitboxes:
            entries[key]["hitbox"] = dict(zip(("x", "y", "width", "height"), hitboxes[key]))
    manifest["sprites"] = sorted(entries.values(), key=lambda s: s["key"])
    with open(MANIFEST, "w") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")
    if contacts:
        from contact_silhouettes import build as build_contacts
        build_contacts()
    print("built", ", ".join(built))


def main(argv, sprites, src_dir, doc, grounds=("5a6988", "e4a672", "ead4aa"), slices=None, once=None,
         hitboxes=None, contacts=()):
    """The command line every art script shares: `build`, or `preview OUT.png`. A script declares the tags that
    play once as a ONCE dict beside its sprites(), and any hit boxes as a HITBOX dict, and passes them here."""
    if len(argv) == 3 and argv[1] == "preview":
        preview(list(sprites()), argv[2], grounds)
    elif len(argv) == 2 and argv[1] == "build":
        build(list(sprites()), src_dir, slices, once, hitboxes, contacts)
    else:
        sys.exit(doc)
