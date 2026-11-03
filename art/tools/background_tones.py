"""Muted background-only paint, using the existing game palette without changing any occupied pixel.

Usage: background_tones.py build, from the repository root. This exports existing backdrop keys only.
The original generators retain their geometry. Their normal builds apply this same publication policy.
Foreground tiles, actors, UI, portraits and opening art never pass through this adapter.
Ordered far, middle and near backgrounds use perceptual ranks in background_palette.py.
Continuous source-colour residuals retain material and detail differences. Local decorative props use
the near rank. Functional wayfinding, flat zone skies and the inactive Park prototype retain their
existing publication policy.
"""

import importlib
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import background_palette
import pixel

PRODUCERS = ("floor1", "depot", "park", "industrial", "countryside", "woodland", "homecity", "apartment")
FUNCTIONAL = frozenset(
    {
        "apartment-room-door",
        "apartment-stairwell",
        "apartment-stairwell-down",
        "lobby-front-door",
        "parcel-open",
        "walk-signal",
    }
)
SKIES = frozenset({"apartment-sky", "countryside-sky", "homecity-sky", "industrial-sky", "street-sky", "woodland-sky"})
FAR = frozenset(
    {
        "apartment-far",
        "countryside-far",
        "homecity-far",
        "industrial-far",
        "park-city",
        "park-clouds",
        "park-far-trees",
        "street-city-far",
        "street-skyline",
        "woodland-far",
        "woodland-far-birch",
        "woodland-far-conifers",
    }
)
MID = frozenset(
    {
        "apartment-exterior-mid",
        "farmland-mid",
        "forest-mid",
        "forest-mid-birch",
        "forest-mid-conifers",
        "freight-mid",
        "neighbourhood-mid",
        "outskirts-mid",
        "park-treetops",
        "ravine-mid",
        "river-mid",
        "street-boundary-mid",
        "street-city-mid",
        "warehouse-mid",
    }
)
NEAR = frozenset(
    {
        "apartment-facade",
        "apartment-wall-lobby",
        "apartment-wall-pool",
        "apartment-wall-residential",
        "apartment-wall-restaurant",
        "apartment-wall-spa",
        "depot-wall",
        "facade-brownstone",
        "facade-brownstone-upper",
        "facade-hotel",
        "facade-hotel-upper",
        "facade-one-storey",
        "facade-walkup",
        "facade-walkup-upper",
        "farmland-fence",
        "forest-shrub",
        "forest-tree",
        "neighbourhood-wall",
        "outskirts-wall",
        "ravine-rock",
        "roofline-brownstone",
        "roofline-hotel",
        "roofline-walkup",
        "storefront-cafe",
        "storefront-diner",
        "storefront-florist",
        "storefront-gift-shop",
        "storefront-makeup-store",
        "storefront-noodle-bar",
        "storefront-pet-shop",
        "warehouse-wall",
    }
)
DEPTH_KEYS = (FAR | MID | NEAR) - {key for key in FAR | MID | NEAR if key.startswith("park-")} - {"street-skyline"}
ZONES = {
    "apartment": "zone-red",
    "countryside": "zone-yellow",
    "homecity": "zone-peach",
    "industrial": "zone-purple",
    "park": "zone-peach",
    "street": "zone-blue",
    "woodland": "zone-green",
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
        "zone-red": "lgrey",
        "zone-red-shade": "zone-red",
        "zone-peach-shade": "zone-peach",
        "brown": "zone-red-shade",
    },
    "apartment-wall-pool": {
        "zone-red": "lgrey",
        "zone-red-shade": "zone-red",
        "zone-blue": "zone-blue",
        "zone-blue-shade": "grey",
    },
    "apartment-wall-spa": {
        "zone-red": "lgrey",
        "zone-red-shade": "zone-red",
        "zone-green": "zone-green",
        "zone-green-shade": "zone-green-shade",
    },
    "lobby-wall": {"dbrown": "zone-red", "plum": "grey", "ink": "slate", "brown": "zone-peach"},
}


def profile(key):
    zone = next((name for name, prefixes in GROUPS.items() if key.startswith(prefixes)), "street")
    layer = (
        "sky" if key in SKIES else "far" if key in FAR else "mid" if key in MID else "near" if key in NEAR else "local"
    )
    return zone, layer


def depth_colour_map(key):
    zone, layer = profile(key)
    if layer == "sky":
        return {pixel.rgb(colour): pixel.rgb(colour) for colour in pixel.K.values()}
    if layer == "local":
        layer = "near"
    result = {}
    for source, colour in background_palette.source_colours(pixel.K).items():
        target = background_palette.detail_name(zone, layer, source)
        if zone == "countryside" and layer == "far" and source == "zone-peach":
            target = "bg-countryside-far-warm"
        elif zone == "woodland" and layer == "mid" and source == "white":
            target = "bg-woodland-mid-bark"
        elif zone == "woodland" and layer == "near" and source == "zone-peach-shade":
            target = "bg-woodland-near-wood"
        result[pixel.rgb(colour)] = pixel.rgb(target)
    # Authored plaster, panels and joints keep separate material roles at the same near depth.
    walls = {
        "apartment-wall-lobby": {
            "zone-red": "bg-apartment-near-light",
            "zone-red-shade": "bg-apartment-near-shade",
            "zone-peach-shade": "bg-apartment-near-wood",
            "brown": "bg-apartment-near-wood-shade",
        },
        "apartment-wall-pool": {
            "zone-red": "bg-apartment-near-light",
            "zone-red-shade": "bg-apartment-near-shade",
            "zone-blue": "bg-apartment-near-blue",
            "zone-blue-shade": "bg-apartment-near-blue-shade",
        },
        "apartment-wall-spa": {
            "zone-red": "bg-apartment-near-light",
            "zone-red-shade": "bg-apartment-near-shade",
            "zone-green": "bg-apartment-near-green",
            "zone-green-shade": "bg-apartment-near-green-shade",
        },
    }
    walls.update(
        {
            "apartment-wall-residential": {
                "zone-red": "bg-apartment-near-light",
                "zone-red-shade": "bg-apartment-near-shade",
            },
            "apartment-wall-restaurant": {
                "zone-red": "bg-apartment-near-light",
                "zone-red-shade": "bg-apartment-near-shade",
                "zone-peach": "bg-apartment-near-wood",
            },
            "apartment-facade": {
                "zone-red": "bg-apartment-near-light",
                "zone-red-shade": "bg-apartment-near-shade",
                "dslate": "bg-apartment-near-shade",
                "zone-blue-shade": "bg-apartment-near-blue",
                "slate": "bg-apartment-near-blue-shade",
            },
            "warehouse-wall": {
                "zone-purple": "bg-industrial-near-light",
                "zone-purple-shade": "bg-industrial-near",
                "slate": "bg-industrial-near-shade",
                "dslate": "bg-industrial-near-shade",
            },
            "outskirts-wall": {"zone-red-shade": "bg-homecity-near-shade"},
        }
    )
    result.update({pixel.rgb(source): pixel.rgb(target) for source, target in walls.get(key, {}).items()})
    return result


def colour_map(key):
    zone, layer = profile(key)
    if zone != "park":
        return depth_colour_map(key)
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
