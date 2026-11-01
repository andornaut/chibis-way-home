"""Naturalistic background forms: irregular leaf masses, tapered branches and species silhouettes.

Shared by environment tools. Pixel clusters are quantized to at least2px at foliage scale; no contour pass.
"""

import math
from PIL import ImageDraw
import pixel


def polygon(im, colour, points):
    ImageDraw.Draw(im).polygon(points, fill=pixel.rgb(colour) + (255,))


def branch(im, colour, start, end, width):
    x, y = start
    ex, ey = end
    dx, dy = ex - x, ey - y
    length = max(1, math.hypot(dx, dy))
    nx, ny = -dy / length, dx / length
    polygon(im, colour, ((x + nx * width / 2, y + ny * width / 2),
                         (ex + nx * width / 5, ey + ny * width / 5),
                         (ex - nx * width / 5, ey - ny * width / 5),
                         (x - nx * width / 2, y - ny * width / 2)))


def leaves(im, colour, box, seed=0):
    x, y, width, height = box
    radii = (0.88, 1.0, 0.92, 1.04, 0.86, 0.98, 1.02, 0.90, 1.0, 0.94, 0.84, 1.02)
    points = []
    step = 2 if width < 80 else 4
    for i in range(36):
        angle = i * math.tau / 36
        radius = radii[(i + seed) % len(radii)]
        px = x + width / 2 + math.cos(angle) * width / 2 * radius
        py = y + height / 2 + math.sin(angle) * height / 2 * radius
        points.append((round(px / step) * step, round(py / step) * step))
    polygon(im, colour, points)


def broadleaf(im, x, top, width, height, bottom, leaf, wood, trunk_width, seed=0):
    centre = x + width * 0.52
    fork = (centre - width * 0.04, top + height * 0.78)
    branch(im, wood, (centre + width * 0.025, bottom), fork, trunk_width)
    for dx, dy in ((0.18, 0.48), (0.78, 0.34), (0.48, 0.18)):
        branch(im, wood, fork, (x + width * dx, top + height * dy), trunk_width * 0.58)
    for dx, dy, w, h, phase in ((0.04, 0.22, 0.64, 0.57, 0), (0.38, 0.10, 0.60, 0.57, 3),
                                (0.20, 0.0, 0.57, 0.53, 6), (0.20, 0.42, 0.62, 0.43, 9)):
        leaves(im, leaf, (x + width * dx, top + height * dy, width * w, height * h), seed + phase)


def spruce(im, x, top, width, height, bottom, leaf, wood, seed=0):
    centre = x + width * 0.51
    branch(im, wood, (centre, bottom), (centre - 2, top + 8), max(4, width * 0.065))
    left = [(centre, top)]
    right = []
    # Irregular drooping bough tiers build one connected tapered crown, rather than stacked triangles.
    for i in range(1, 12):
        yy = top + height * i / 12
        spread = width * (0.08 + i / 26) * (0.90 + ((i + seed) % 3) * 0.07)
        left.extend(((centre - spread * 0.60, yy - height * 0.05),
                     (centre - spread, yy + height * 0.035)))
        right[0:0] = [(centre + spread * 0.90, yy + height * 0.01),
                      (centre + spread * 0.57, yy - height * 0.06)]
    polygon(im, leaf, left + [(centre - width * 0.20, top + height),
                              (centre + width * 0.17, top + height)] + right)

