"""Perceptual background ranks and zone-coloured decorative fauna.

Preserve the six flat zone skies. Far, middle and near use progressively darker
OKLab lightness bands and bounded chroma, retaining continuous source-material
differences. Fauna follows the nearest background with at least 2:1 contrast
against its darkest published material. Alpha and geometry are not paint data.
"""

import math

import zone_themes
from art_kit.colour import oklch_to_srgb, srgb_to_oklab, srgb_to_oklch

ZONES = {
    "apartment": "apartment",
    "countryside": "countryside",
    "homecity": "home-city",
    "industrial": "industrial",
    "street": "blue-cityscape",
    "woodland": "woodland",
}
RANK = {"far": 1, "mid": 2, "near": 3}
LIGHTNESS_STEP = 0.035
WIDTH = {"far": 0.010, "mid": 0.014, "near": 0.018}
CHROMA = {"far": 0.022, "mid": 0.030, "near": 0.038}
MATERIAL_WEIGHT = {"far": 0.25, "mid": 0.40, "near": 0.60}
ROLES = {"light": 1, "base": 0, "shade": -1}
FAUNA_CONTRAST = 2
FAUNA_CHROMA_FRACTION = 0.35
FAUNA_CHROMA_CAP = 0.028
FAUNA_SHADES = {
    "apartment": "plum",
    "countryside": "dbrown",
    "homecity": "dbrown",
    "industrial": "plum",
    "street": "navy",
    "woodland": "forest",
}
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


def source_colours(house):
    """Raw paint excludes generated depth colours and the foreground warning role."""
    return {name: colour for name, colour in house.items() if not name.startswith("bg-") and name != "warning-red"}


def primary(zone):
    return zone_themes.THEMES[ZONES[zone]]["colour"]


def encoded(chroma_cap, colour):
    """Keep the game layer's cap after byte quantisation, using canonical conversions."""
    lightness, a, b = colour
    for _ in range(16):
        rgb = oklch_to_srgb((lightness, math.hypot(a, b), math.degrees(math.atan2(b, a))))
        _, actual_chroma, _ = srgb_to_oklch(rgb)
        if actual_chroma <= chroma_cap:
            return bytes(rgb).hex()
        scale = min(0.99, (chroma_cap - 0.0002) / actual_chroma)
        a *= scale
        b *= scale
    raise ValueError("The background paint cannot meet its quantised chroma cap")


def material(zone, layer, role, colour):
    """Retain source hue and continuous lightness detail inside a semantic rank."""
    zone_l, zone_a, zone_b = srgb_to_oklab(tuple(bytes.fromhex(primary(zone))))
    source_l, source_a, source_b = srgb_to_oklab(tuple(bytes.fromhex(colour)))
    weight = MATERIAL_WEIGHT[layer]
    offset = 2 * source_l - 1 if role is None else ROLES[role]
    lightness = zone_l - LIGHTNESS_STEP * RANK[layer] + WIDTH[layer] * offset
    a = (1 - weight) * zone_a + weight * source_a
    b = (1 - weight) * zone_b + weight * source_b
    chroma = math.hypot(a, b)
    if chroma > CHROMA[layer]:
        scale = CHROMA[layer] / chroma
        a *= scale
        b *= scale
    return encoded(CHROMA[layer], (lightness, a, b))


def paint(zone, layer, role="base", hue=None):
    return material(zone, layer, role, primary(zone) if hue is None else hue)


def detail(zone, layer, colour):
    return material(zone, layer, None, colour)


def name(zone, layer, role="base"):
    return f"bg-{zone}-{layer}" + ("" if role == "base" else f"-{role}")


def detail_name(zone, layer, source):
    return f"bg-{zone}-{layer}-source-{source}"


def fauna(zone, near_colours):
    """Find the lightest quantised fauna paint with 2:1 on every near material."""
    zone_l, zone_a, zone_b = srgb_to_oklab(tuple(bytes.fromhex(primary(zone))))
    chroma = min(math.hypot(zone_a, zone_b) * FAUNA_CHROMA_FRACTION, FAUNA_CHROMA_CAP)
    angle = math.atan2(zone_b, zone_a)
    a, b = chroma * math.cos(angle), chroma * math.sin(angle)
    target = (min(map(luminance, near_colours)) + 0.05) / FAUNA_CONTRAST - 0.05
    low, high = 0.0, zone_l
    best = encoded(chroma, (low, a, b))
    for _ in range(40):
        middle = (low + high) / 2
        candidate = encoded(chroma, (middle, a, b))
        if luminance(candidate) <= target:
            low, best = middle, candidate
        else:
            high = middle
    return best


def colours(house):
    sources = source_colours(house)
    result = {name(zone, layer, role): paint(zone, layer, role) for zone in ZONES for layer in RANK for role in ROLES}
    result.update(
        {
            detail_name(zone, layer, source): detail(zone, layer, colour)
            for zone in ZONES
            for layer in RANK
            for source, colour in sources.items()
        }
    )
    result.update({key: paint(zone, layer, role, sources[hue]) for key, (zone, layer, role, hue) in MATERIALS.items()})
    for zone in ZONES:
        near = [colour for key, colour in result.items() if key.startswith(name(zone, "near"))]
        result[name(zone, "fauna")] = fauna(zone, near)
    return result


def first_darker(darker, target, colour):
    """Follow the existing shade family until modal dimming decreases luminance."""
    seen = set()
    while luminance(target) >= luminance(colour):
        if target in seen or target not in darker:
            raise ValueError("The existing palette has no strictly darker shade")
        seen.add(target)
        target = darker[target]
    return target


def ramps(darker, house):
    # Modal dimming uses substantial existing shade steps rather than depth-band steps.
    paints = colours(house)
    result = {
        colour: house[zone_themes.THEMES[theme]["primary"] + "-shade"]
        for zone, theme in ZONES.items()
        for key, colour in paints.items()
        if key.startswith(f"bg-{zone}-")
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
        **{name(zone, "fauna"): shade for zone, shade in FAUNA_SHADES.items()},
    }
    result.update({paints[key]: house[target] for key, target in material_shades.items()})
    return {colour: first_darker(darker, target, colour) for colour, target in result.items() if colour not in darker}
