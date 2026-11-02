"""Small value steps for decorative sky/far/middle/near depth, preserving canonical zone skies.

Far, middle and near bases are 0.035, 0.070 and 0.105 below the sky in linear relative luminance.
Each layer retains a light/base/shade material ramp; near joints have a wider dark step than far haze.
Extra warm, wood, blue, green and birch paints retain distinct materials at their owning depth.
These colours extend the game palette only. Existing palette colours and darker mappings stay unchanged.
"""

import zone_themes

ZONES = {
    "apartment": "apartment",
    "countryside": "countryside",
    "homecity": "home-city",
    "industrial": "industrial",
    "street": "blue-cityscape",
    "woodland": "woodland",
}
DEPTH = {"far": 0.035, "mid": 0.070, "near": 0.105}
LIGHT = {"far": 0.008, "mid": 0.008, "near": 0.012}
SHADE = {"far": 0.008, "mid": 0.016, "near": 0.035}
MATERIALS = {
    "bg-apartment-near-blue": ("apartment", "near", "base", "zone-blue"),
    "bg-apartment-near-blue-shade": ("apartment", "near", "shade", "zone-blue"),
    "bg-apartment-near-green": ("apartment", "near", "base", "zone-green"),
    "bg-apartment-near-green-shade": ("apartment", "near", "shade", "zone-green"),
    "bg-apartment-near-wood": ("apartment", "near", "base", "zone-peach"),
    "bg-apartment-near-wood-shade": ("apartment", "near", "shade", "zone-peach"),
    "bg-countryside-far-warm": ("countryside", "far", "base", "zone-peach"),
    "bg-woodland-mid-bark": ("woodland", "mid", "light", "lgrey"),
    "bg-woodland-near-wood": ("woodland", "near", "shade", "zone-peach"),
}


def linear(channel):
    value = channel / 255
    return value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4


def luminance(colour):
    return sum(
        linear(channel) * weight
        for channel, weight in zip(bytes.fromhex(colour), (0.2126, 0.7152, 0.0722), strict=True)
    )


def paint(zone, layer, role="base", hue=None):
    primary = zone_themes.THEMES[ZONES[zone]]["colour"]
    target = luminance(primary) - DEPTH[layer]
    target += LIGHT[layer] if role == "light" else -SHADE[layer] if role == "shade" else 0
    source = primary if hue is None else hue
    ratio = target / luminance(source)
    channels = [min(1, linear(channel) * ratio) for channel in bytes.fromhex(source)]
    rgb = [
        round(255 * (12.92 * channel if channel <= 0.0031308 else 1.055 * channel ** (1 / 2.4) - 0.055))
        for channel in channels
    ]
    return bytes(rgb).hex()


def name(zone, layer, role="base"):
    return f"bg-{zone}-{layer}" + ("" if role == "base" else f"-{role}")


def colours(house):
    result = {
        name(zone, layer, role): paint(zone, layer, role)
        for zone in ZONES
        for layer in DEPTH
        for role in ("light", "base", "shade")
    }
    result.update({key: paint(zone, layer, role, house[hue]) for key, (zone, layer, role, hue) in MATERIALS.items()})
    return result


def ramps(house):
    # Modals take three substantial existing shade steps, independently of small depth spacing.
    paints = colours(house)
    result = {
        paints[name(zone, layer, role)]: house[zone_themes.THEMES[theme]["primary"] + "-shade"]
        for zone, theme in ZONES.items()
        for layer in DEPTH
        for role in ("light", "base", "shade")
    }
    material_shades = {
        "bg-apartment-near-blue": "zone-blue-shade",
        "bg-apartment-near-blue-shade": "slate",
        "bg-apartment-near-green": "zone-green-shade",
        "bg-apartment-near-green-shade": "zone-green-shade",
        "bg-apartment-near-wood": "zone-peach-shade",
        "bg-apartment-near-wood-shade": "zone-peach-shade",
        "bg-countryside-far-warm": "zone-peach-shade",
        "bg-woodland-mid-bark": "grey",
        "bg-woodland-near-wood": "zone-peach-shade",
    }
    result.update({paints[key]: house[target] for key, target in material_shades.items()})
    return result
