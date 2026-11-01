"""Export exact opaque sprite contact as sparse horizontal pixel runs from final PNG exports.

Usage: python3 -I art/tools/contact_silhouettes.py build, from the repository root.
Only manifest sprites explicitly marked contact='silhouette' participate. Each exact Aseprite frame name
maps to sorted [y,left,rightExclusive] runs in the full untrimmed frame. Adjacent pixels form one run.
Alpha greater than zero is occupied; partial alpha is rejected. Coloured outlines are part of the body.
Portraits, projectiles, traps and separate effects are excluded by their absence of the contact marker.
No pixels, frames, tags, timings, anchors or physical reach boxes are changed by this export.
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pixel
from PIL import Image

OUT = "public/art/contact-silhouettes.json"


def occupied_runs(im):
    """Full-frame rows, top to bottom; intervals are half open and merged left to right."""
    alpha = im.getchannel("A")
    if not (set(alpha.getdata()) <= {0, 255}):
        raise AssertionError("Contact art must have binary alpha")
    runs = []
    for y in range(im.height):
        left = None
        for x in range(im.width + 1):
            occupied = x < im.width and alpha.getpixel((x, y)) > 0
            if occupied and left is None:
                left = x
            elif not occupied and left is not None:
                runs.append([y, left, x])
                left = None
    return runs


def sprite_masks(entry):
    """Read final exported frame rectangles, retaining exact Aseprite names and untrimmed coordinates."""
    with Path("public/art/" + entry["json"]).open() as source:
        data = json.load(source)
    with Image.open("public/art/" + entry["png"]) as source:
        sheet = source.convert("RGBA")
    frames, size = {}, None
    if not (data["frames"]):
        raise AssertionError(f"{entry['key']}: no exported frames")
    for name, frame in data["frames"].items():
        rect = frame["frame"]
        current = (rect["w"], rect["h"])
        if not (not frame["trimmed"] and (not frame["rotated"])):
            raise AssertionError(f"{name}: contact requires untrimmed frames")
        if not (frame["sourceSize"] == {"w": current[0], "h": current[1]}):
            raise AssertionError(f"{name}: source size mismatch")
        if not (frame["spriteSourceSize"] == {"x": 0, "y": 0, "w": current[0], "h": current[1]}):
            raise AssertionError
        if not (size is None or current == size):
            raise AssertionError(f"{name}: inconsistent frame size")
        size = current
        x, y = rect["x"], rect["y"]
        if not (x >= 0):
            raise AssertionError
        if not (y >= 0):
            raise AssertionError
        if not (x + size[0] <= sheet.width):
            raise AssertionError
        if not (y + size[1] <= sheet.height):
            raise AssertionError
        frames[name] = occupied_runs(sheet.crop((x, y, x + size[0], y + size[1])))
    return {"width": size[0], "height": size[1], "frames": frames}


def build():
    with Path(pixel.MANIFEST).open() as source:
        manifest = json.load(source)
    sprites = {
        entry["key"]: sprite_masks(entry) for entry in manifest["sprites"] if entry.get("contact") == "silhouette"
    }
    with Path(OUT).open("w") as target:
        json.dump({"version": 1, "sprites": sprites}, target, sort_keys=True, separators=(",", ":"))
        target.write("\n")
    pixel.update_manifest("data", [{"key": "contact-silhouettes", "json": "contact-silhouettes.json"}])
    print("built contact silhouettes:", ", ".join(sorted(sprites)))


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    else:
        raise SystemExit(__doc__)
