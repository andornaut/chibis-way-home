"""Export the approved storybook opening's painted sources and demonstrate its layered motion.

Usage from the repository root: opening.py build | preview OUT.gif | board OUT.png
Pillow only. Build reads art/opening/source and writes three opaque 720x360 background images,
four 512x512 pose sheets with four 256x256 frames, and authoring contract/manifest-entry JSON.
Every pose uses a canvas bottom-centre anchor at (128,232). Opening layers have no hit boxes.

Chibi poses: rest, blink, sleep, wake. Ferret poses: friendly, gesture, argument, pack.
Parcel poses: open, half-closed, sealed, opened. Parcel-front repeats those frame indices and
occludes the lower part of the bird when he is inside the carton. Source cutouts are normalized
to binary alpha; their soft painted colours are retained. Gameplay pixel assets are unchanged.

The preview is a motion study, not runtime playback policy. Its illustrative time scale does
not choose scene duration, controls, skip, replay or save behaviour. Pose changes, breathing,
gestures, a sleeping-bird transfer, lid closure, parcel travel and waking are actual layer motion.
No argument cause, dialogue, character-name artwork or friendship outcome is supplied.
"""

import json
import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

SOURCE = Path("art/opening/source")
AUTHORING = Path("art/opening")
VIEW = (720, 360)
FRAME = (256, 256)
ANCHOR = (128, 232)
BACKGROUNDS = ("home", "transit", "depot")
POSES = {
    "chibi": {"tags": ("rest", "blink", "sleep", "wake"), "envelope": (208, 88)},
    "ferret": {"tags": ("friendly", "gesture", "argument", "pack"), "envelope": (220, 190)},
    "parcel": {"tags": ("open", "half-closed", "sealed", "opened"), "envelope": (220, 156)},
}


def save_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + "\n")


def source_cells(kind, size):
    width, height = size
    middle = height // 2
    if kind == "parcel":
        # The source's open flaps use more horizontal space than its closed carton.
        top_split, bottom_split = round(width * 0.54), round(width * 0.49)
        return [
            (0, 0, top_split, middle),
            (top_split, 0, width, middle),
            (0, middle, bottom_split, height),
            (bottom_split, middle, width, height),
        ]
    split = width // 2
    return [
        (0, 0, split, middle),
        (split, 0, width, middle),
        (0, middle, split, height),
        (split, middle, width, height),
    ]


def pose_frames(spec, kind):
    source = Image.open(SOURCE / f"{kind}-poses.png").convert("RGBA")
    source.putalpha(source.getchannel("A").point(lambda alpha: 255 if alpha >= 128 else 0))
    crops = []
    for cell in source_cells(kind, source.size):
        pose = source.crop(cell)
        bounds = pose.getbbox()
        if bounds is None:
            raise ValueError(f"Empty opening pose: {kind}")
        crops.append(pose.crop(bounds))
    scale = min(spec["envelope"][0] / max(p.width for p in crops), spec["envelope"][1] / max(p.height for p in crops))
    frames = []
    for source_pose in crops:
        size = (max(1, round(source_pose.width * scale)), max(1, round(source_pose.height * scale)))
        pose = source_pose.resize(size, Image.Resampling.LANCZOS)
        pose.putalpha(pose.getchannel("A").point(lambda alpha: 255 if alpha >= 128 else 0))
        frame = Image.new("RGBA", FRAME)
        frame.alpha_composite(pose, (ANCHOR[0] - pose.width // 2, ANCHOR[1] - pose.height))
        frames.append(frame)
    return frames


def sprite_metadata(key, tags, frames):
    return {
        "frames": {
            f"{key}-{index}": {
                "frame": {"x": index % 2 * 256, "y": index // 2 * 256, "w": 256, "h": 256},
                "rotated": False,
                "trimmed": False,
                "spriteSourceSize": {"x": 0, "y": 0, "w": 256, "h": 256},
                "sourceSize": {"w": 256, "h": 256},
                "duration": 1000,
            }
            for index in range(len(frames))
        },
        "meta": {
            "app": "opening-art",
            "image": f"{key}.png",
            "format": "RGBA8888",
            "size": {"w": 512, "h": 512},
            "scale": "1",
            "frameTags": [
                {"name": name, "from": index, "to": index, "direction": "forward"} for index, name in enumerate(tags)
            ],
        },
    }


def write_sprite(key, tags, frames):
    directory = Path("public/art/sprites")
    directory.mkdir(parents=True, exist_ok=True)
    sheet = Image.new("RGBA", (512, 512))
    for index, pose in enumerate(frames):
        sheet.alpha_composite(pose, (index % 2 * 256, index // 2 * 256))
    sheet.save(directory / f"{key}.png")
    save_json(directory / f"{key}.json", sprite_metadata(key, tags, frames))
    return {"key": key, "png": f"sprites/{key}.png", "json": f"sprites/{key}.json", "once": []}


def build():
    images = Path("public/art/images")
    images.mkdir(parents=True, exist_ok=True)
    entries = {"images": [], "sprites": []}
    contract = {
        "viewport": {"width": 720, "height": 360},
        "frame": {"width": 256, "height": 256, "columns": 2, "rows": 2},
        "anchor": {"x": 128, "y": 232},
        "backgrounds": {},
        "poses": {},
        "parcelFrontEdges": [],
        "layerOrder": ["background", "parcel", "actors", "parcel-front"],
    }
    for name in BACKGROUNDS:
        key = f"opening-{name}-background"
        picture = Image.open(SOURCE / f"{name}.png").convert("RGB").resize(VIEW, Image.Resampling.LANCZOS)
        picture.save(images / f"{key}.png")
        entries["images"].append({"key": key, "png": f"images/{key}.png", "width": 720, "height": 360})
        contract["backgrounds"][name] = key
    for kind, spec in POSES.items():
        frames = pose_frames(spec, kind)
        key = f"opening-{kind}"
        entries["sprites"].append(write_sprite(key, spec["tags"], frames))
        contract["poses"][key] = {name: index for index, name in enumerate(spec["tags"])}
        if kind == "parcel":
            front = []
            for _index, (pose, fraction) in enumerate(zip(frames, (0.48, 0.36, 0.0, 0.50), strict=False)):
                bounds = pose.getbbox()
                edge = bounds[1] + round((bounds[3] - bounds[1]) * fraction)
                layer = pose.copy()
                if edge > 0:
                    layer.paste((0, 0, 0, 0), (0, 0, 256, edge))
                front.append(layer)
                contract["parcelFrontEdges"].append(edge)
            front_key = "opening-parcel-front"
            entries["sprites"].append(write_sprite(front_key, spec["tags"], front))
            contract["poses"][front_key] = contract["poses"][key]
    save_json(AUTHORING / "contract.json", contract)
    save_json(AUTHORING / "manifest-entries.json", entries)
    print("Exported three opening backgrounds and four pose sheets")


def read_pose(key, index):
    sheet = Image.open(f"public/art/sprites/{key}.png").convert("RGBA")
    x, y = index % 2 * 256, index // 2 * 256
    return sheet.crop((x, y, x + 256, y + 256))


def actor(canvas, feet, key, index, scale=1, angle=0, opacity=1):
    pose = read_pose(key, index)
    if angle:
        pose = pose.rotate(angle, Image.Resampling.BICUBIC, center=ANCHOR)
    if opacity < 1:
        pose.putalpha(pose.getchannel("A").point(lambda alpha: round(alpha * opacity)))
    if scale != 1:
        pose = pose.resize((round(256 * scale), round(256 * scale)), Image.Resampling.LANCZOS)
    canvas.alpha_composite(pose, (round(feet[0] - ANCHOR[0] * scale), round(feet[1] - ANCHOR[1] * scale)))


def study_frame(beat, phase):
    """A normalized motion demonstration, independent of production playback timing."""
    background = "depot" if beat == 4 else "transit" if beat == 3 else "home"
    image = Image.open(f"public/art/images/opening-{background}-background.png").convert("RGBA")
    breathe = 1 + 0.012 * math.sin(phase * math.tau * 2)
    if beat == 0:
        actor(image, (244, 270), "opening-chibi", 1 if 0.44 < phase < 0.49 else 0, breathe)
        actor(image, (466, 270), "opening-ferret", 1 if 0.26 < phase < 0.68 else 0)
    elif beat == 1:
        actor(image, (244 - 16 * math.sin(phase * math.pi), 270), "opening-chibi", 1 if phase > 0.7 else 0)
        actor(image, (452, 270), "opening-ferret", 2, angle=2 * math.sin(phase * math.pi))
    elif beat == 2:
        parcel_frame = 0 if phase < 0.66 else 1 if phase < 0.82 else 2
        actor(image, (358, 270), "opening-parcel", parcel_frame)
        actor(image, (458, 270), "opening-ferret", 3)
        if phase < 0.76:
            transfer = min(1, phase / 0.60)
            bird_x = 260 + 98 * transfer
            bird_y = 238 - 30 * math.sin(transfer * math.pi)
            actor(image, (bird_x, bird_y), "opening-chibi", 2, breathe)
        actor(image, (358, 270), "opening-parcel-front", parcel_frame)
    elif beat == 3:
        actor(
            image,
            (-110 + phase * 940, 236 + 4 * math.sin(phase * math.tau)),
            "opening-parcel",
            2,
            angle=2 * math.sin(phase * math.tau * 2),
        )
    else:
        parcel_frame = 2 if phase < 0.12 else 1 if phase < 0.24 else 3
        actor(image, (360, 270), "opening-parcel", parcel_frame)
        if phase > 0.24:
            bird_frame = 2 if phase < 0.42 else 3 if phase < 0.64 else 0
            bird_y = 234 - 20 * min(1, max(0, (phase - 0.42) / 0.3))
            actor(image, (360, bird_y), "opening-chibi", bird_frame, breathe)
        actor(image, (360, 270), "opening-parcel-front", parcel_frame)
    return image.convert("RGB")


def preview(path):
    # Art study cadence only. Gameplay data supplies all actual scene durations and controls.
    frames = [study_frame(beat, index / 29) for beat in range(5) for index in range(30)]
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=100, loop=0, disposal=2)
    print(path)


def board(path):
    points = [
        (0, 0.4, "Friendship"),
        (1, 0.5, "Argument"),
        (2, 0.5, "Sleeping Chibi is packed"),
        (3, 0.5, "Postal transit"),
        (4, 0.5, "Waking far from home"),
    ]
    page = Image.new("RGB", (1440, 1176), "#222034")
    draw = ImageDraw.Draw(page)
    for index, (beat, phase, label) in enumerate(points):
        x, y = index % 2 * 720, index // 2 * 392
        draw.text((x + 12, y + 10), label, font=ImageFont.load_default(), fill="#ead4aa")
        page.paste(study_frame(beat, phase), (x, y + 32))
    page.save(path)
    print(path)


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "build":
        build()
    elif len(sys.argv) == 3 and sys.argv[1] in ("preview", "board"):
        {"preview": preview, "board": board}[sys.argv[1]](sys.argv[2])
    else:
        raise SystemExit("Usage: opening.py build | preview OUT.gif | board OUT.png")
