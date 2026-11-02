"""Muted background-only paint, using the existing game palette without changing any occupied pixel.

Usage: background_tones.py build, from the repository root. This exports existing backdrop keys only.
The original generators retain their geometry. Their normal builds apply this same publication policy.
Foreground tiles, actors, UI, portraits and opening art never pass through this adapter.
Far atmosphere uses pale haze, middle and local scenery use compressed pastel ramps, and functional
wayfinding retains its authored colours. Existing flat zone skies are already muted identity colours.
"""

import importlib
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pixel

PRODUCERS = ("floor1", "depot", "park", "industrial", "countryside", "woodland", "homecity", "apartment")
FUNCTIONAL = frozenset({"apartment-room-door", "apartment-stairwell", "apartment-stairwell-down",
                        "lobby-front-door", "parcel-open", "walk-signal"})
SKIES = frozenset({"apartment-sky", "countryside-sky", "homecity-sky", "industrial-sky", "street-sky",
                   "woodland-sky"})
FAR = frozenset({"apartment-far", "countryside-far", "homecity-far", "industrial-far", "park-city",
                 "park-clouds", "park-far-trees", "street-city-far", "street-skyline", "woodland-far",
                 "woodland-far-birch", "woodland-far-conifers"})
MID = frozenset({"apartment-exterior-mid", "farmland-mid", "forest-mid", "forest-mid-birch",
                 "forest-mid-conifers", "freight-mid", "neighbourhood-mid", "outskirts-mid",
                 "park-treetops", "ravine-mid", "river-mid", "street-boundary-mid", "street-city-mid"})
ZONES = {
    "apartment": "zone-red", "countryside": "zone-yellow", "homecity": "zone-peach",
    "industrial": "zone-purple", "park": "zone-peach", "street": "zone-blue", "woodland": "zone-green",
}
GROUPS = {
    "apartment": ("apartment-", "lobby-"),
    "countryside": ("countryside-", "farmland-", "river-"),
    "homecity": ("homecity-", "neighbourhood-", "outskirts-"),
    "industrial": ("freight-", "industrial-", "warehouse-"),
    "park": ("park-",),
    "woodland": ("forest-", "ravine-", "woodland-"),
}
ACCENTS = {
    **dict.fromkeys(("blue", "sky", "cyan", "zone-blue", "zone-blue-shade"), "zone-blue"),
    **dict.fromkeys(("green", "dgreen", "forest", "teal", "zone-green", "zone-green-shade"), "zone-green"),
    **dict.fromkeys(("red", "dred", "hot", "pink"), "zone-red"),
    **dict.fromkeys(("orange", "amber", "yellow", "rust", "ochre", "skin1", "tan"), "zone-peach"),
}


# Each authored wall paint represents a material role: keep joints distinct from adjacent panels.
WALL_PAINT = {
    "apartment-wall-lobby": {
        "zone-red": "lgrey", "zone-red-shade": "zone-red",
        "zone-peach-shade": "zone-peach", "brown": "zone-red-shade",
    },
    "apartment-wall-pool": {
        "zone-red": "lgrey", "zone-red-shade": "zone-red",
        "zone-blue": "zone-blue", "zone-blue-shade": "grey",
    },
    "apartment-wall-spa": {
        "zone-red": "lgrey", "zone-red-shade": "zone-red",
        "zone-green": "zone-green", "zone-green-shade": "zone-green-shade",
    },
    "lobby-wall": {"dbrown": "zone-red", "plum": "grey", "ink": "slate", "brown": "zone-peach"},
}


def profile(key):
    zone = next((name for name, prefixes in GROUPS.items() if key.startswith(prefixes)), "street")
    layer = "sky" if key in SKIES else "far" if key in FAR else "mid" if key in MID else "local"
    return zone, layer


def colour_map(key):
    zone, layer = profile(key)
    primary = ZONES[zone]
    result = {}
    for name, colour in pixel.K.items():
        brightness = pixel.contrast(colour, pixel.K["ink"])
        if layer == "far":
            fill = "zone-peach" if zone == "countryside" else "lgrey"
            tone = fill if brightness < 8 else "lgrey" if fill != "lgrey" else "white"
        elif zone == "street" and layer == "mid":
            tone = "grey" if brightness < 8 else "lgrey"
        elif zone == "woodland":
            tone = primary if brightness < 3 else "lgrey" if brightness < 8 else "white"
        elif layer == "local" and name in ACCENTS:
            tone = ACCENTS[name]
        else:
            tone = primary + "-shade" if brightness < 3 else primary if brightness < 8 else "lgrey"
        result[pixel.rgb(colour)] = pixel.rgb(tone)
    result.update({pixel.rgb(source): pixel.rgb(target) for source, target in WALL_PAINT.get(key, {}).items()})
    return result


def apply(key, image):
    if key in FUNCTIONAL or key in SKIES:
        return image
    original = image.convert("RGBA")
    mapping = colour_map(key)
    original.putdata([(*mapping[p[:3]], p[3]) if p[3] else p for p in original.get_flattened_data()])
    return original


def source_images():
    for name in PRODUCERS:
        module = importlib.import_module(name)
        if name == "depot":
            for key, (image, _) in module.assets().items():
                yield key, image
        elif name in {"floor1", "park"}:
            for key, (draw, _, _) in module.BACKDROP_DEFS.items():
                raw = draw()
                yield key, module.frame_image(raw.px) if name == "floor1" else raw
        else:
            for key, entry in module.BACKDROPS.items():
                yield key, entry[0]()
    props = importlib.import_module("apartment_props")
    for key in props.SIZES:
        yield "apartment-" + key, props.draw(key)


def build():
    for key, image in source_images():
        if key not in FUNCTIONAL:
            apply(key, image).save(f"public/art/backdrops/{key}.png")
    print("built muted existing background paints")


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    else:
        raise SystemExit(__doc__)
