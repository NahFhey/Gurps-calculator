from __future__ import annotations

from pathlib import Path
from typing import Iterable

from PIL import Image, ImageChops, ImageDraw, ImageFilter


REPO_ROOT = Path(__file__).resolve().parent.parent
ASSET_DIR = REPO_ROOT / "assets" / "icon"
PUBLIC_DIR = REPO_ROOT / "public"

MASTER_PNG = ASSET_DIR / "app-icon.png"
WINDOWS_ICO = ASSET_DIR / "app-icon.ico"
FAVICON_PNG = PUBLIC_DIR / "favicon.png"
FAVICON_ICO = PUBLIC_DIR / "favicon.ico"

CANVAS_SIZE = 1024
CENTER = CANVAS_SIZE // 2
BACKGROUND_RADIUS = 220


def ensure_dirs() -> None:
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)


def draw_vertical_gradient(
    draw: ImageDraw.ImageDraw,
    bounds: tuple[int, int, int, int],
    top_color: tuple[int, int, int],
    bottom_color: tuple[int, int, int],
) -> None:
    left, top, right, bottom = bounds
    height = max(bottom - top, 1)
    for offset in range(height):
        mix = offset / max(height - 1, 1)
        color = tuple(
            int(top_color[index] * (1 - mix) + bottom_color[index] * mix)
            for index in range(3)
        )
        draw.line((left, top + offset, right, top + offset), fill=color)


def apply_rounded_mask(image: Image.Image, radius: int) -> Image.Image:
    mask = Image.new("L", image.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, image.width - 1, image.height - 1),
        radius=radius,
        fill=255,
    )
    output = image.copy()
    output.putalpha(mask)
    return output


def point_on_circle(angle_degrees: float, radius: float) -> tuple[float, float]:
    from math import cos, radians, sin

    angle = radians(angle_degrees - 90)
    return (
        CENTER + cos(angle) * radius,
        CENTER + sin(angle) * radius,
    )


def draw_star_point(
    canvas: Image.Image,
    angle: float,
    length: int,
    width: int,
    color: tuple[int, int, int, int],
    glow_color: tuple[int, int, int, int],
) -> None:
    from math import cos, radians, sin

    angle_radians = radians(angle - 90)
    perp_radians = angle_radians + (3.141592653589793 / 2)

    tip = point_on_circle(angle, length)
    base = point_on_circle(angle, 150)
    left = (
        CENTER + cos(perp_radians) * width,
        CENTER + sin(perp_radians) * width,
    )
    right = (
        CENTER - cos(perp_radians) * width,
        CENTER - sin(perp_radians) * width,
    )

    shadow_layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow_layer)
    shadow_polygon = [
        (left[0], left[1] + 18),
        tip,
        (right[0], right[1] + 18),
        base,
    ]
    shadow_draw.polygon(shadow_polygon, fill=glow_color)
    shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(18))
    canvas.alpha_composite(shadow_layer)

    draw = ImageDraw.Draw(canvas)
    draw.polygon([left, tip, right, base], fill=color)


def draw_center_gem(canvas: Image.Image) -> None:
    gem_layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    gem_draw = ImageDraw.Draw(gem_layer)

    outer = [
        (CENTER, CENTER - 170),
        (CENTER + 138, CENTER - 42),
        (CENTER + 138, CENTER + 42),
        (CENTER, CENTER + 170),
        (CENTER - 138, CENTER + 42),
        (CENTER - 138, CENTER - 42),
    ]
    gem_draw.polygon(outer, fill=(112, 26, 32, 255))

    facets = [
        [(CENTER, CENTER - 158), (CENTER + 118, CENTER - 36), (CENTER, CENTER - 10)],
        [(CENTER, CENTER - 10), (CENTER + 118, CENTER - 36), (CENTER + 112, CENTER + 30), (CENTER, CENTER + 150)],
        [(CENTER, CENTER - 10), (CENTER, CENTER + 150), (CENTER - 112, CENTER + 30), (CENTER - 118, CENTER - 36)],
        [(CENTER, CENTER - 158), (CENTER, CENTER - 10), (CENTER - 118, CENTER - 36)],
    ]
    facet_colors = [
        (208, 86, 83, 210),
        (148, 30, 40, 230),
        (124, 26, 34, 230),
        (232, 130, 120, 210),
    ]
    for polygon, color in zip(facets, facet_colors):
        gem_draw.polygon(polygon, fill=color)

    gem_draw.line(
        [(CENTER, CENTER - 160), (CENTER, CENTER + 150)],
        fill=(255, 224, 204, 170),
        width=10,
    )
    gem_draw.line(
        [(CENTER - 118, CENTER - 36), (CENTER + 118, CENTER - 36)],
        fill=(255, 236, 214, 150),
        width=8,
    )
    gem_draw.line(
        [(CENTER - 112, CENTER + 30), (CENTER, CENTER - 10), (CENTER + 112, CENTER + 30)],
        fill=(255, 232, 214, 140),
        width=8,
    )
    gem_draw.line(
        [(CENTER - 84, CENTER - 92), (CENTER + 36, CENTER - 134)],
        fill=(255, 244, 227, 185),
        width=14,
    )

    gem_glow = gem_layer.filter(ImageFilter.GaussianBlur(22))
    canvas.alpha_composite(
        ImageChops.multiply(gem_glow, Image.new("RGBA", canvas.size, (255, 120, 120, 255)))
    )
    canvas.alpha_composite(gem_layer)

    draw = ImageDraw.Draw(canvas)
    draw.polygon(outer, outline=(255, 233, 194, 220), width=12)


def draw_icon() -> Image.Image:
    base = Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE), (0, 0, 0, 0))
    base_draw = ImageDraw.Draw(base)
    draw_vertical_gradient(
        base_draw,
        (0, 0, CANVAS_SIZE, CANVAS_SIZE),
        (31, 54, 85),
        (9, 14, 22),
    )

    grid_layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    grid_draw = ImageDraw.Draw(grid_layer)
    grid_color = (113, 148, 196, 46)
    for position in range(110, CANVAS_SIZE - 110, 86):
        grid_draw.line((position, 90, position, CANVAS_SIZE - 90), fill=grid_color, width=3)
        grid_draw.line((90, position, CANVAS_SIZE - 90, position), fill=grid_color, width=3)
    grid_layer = grid_layer.filter(ImageFilter.GaussianBlur(0.6))
    base.alpha_composite(grid_layer)

    vignette = Image.new("L", base.size, 0)
    vignette_draw = ImageDraw.Draw(vignette)
    vignette_draw.ellipse((80, 80, CANVAS_SIZE - 80, CANVAS_SIZE - 80), fill=210)
    vignette = vignette.filter(ImageFilter.GaussianBlur(120))
    vignette_rgba = Image.new("RGBA", base.size, (0, 0, 0, 0))
    vignette_rgba.putalpha(ImageChops.invert(vignette))
    base.alpha_composite(vignette_rgba)

    ring_layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    ring_draw = ImageDraw.Draw(ring_layer)
    ring_draw.ellipse(
        (172, 172, CANVAS_SIZE - 172, CANVAS_SIZE - 172),
        outline=(209, 177, 88, 255),
        width=24,
    )
    ring_draw.ellipse(
        (220, 220, CANVAS_SIZE - 220, CANVAS_SIZE - 220),
        outline=(255, 227, 163, 130),
        width=6,
    )
    ring_glow = ring_layer.filter(ImageFilter.GaussianBlur(22))
    base.alpha_composite(
        ImageChops.multiply(ring_glow, Image.new("RGBA", base.size, (255, 220, 130, 255)))
    )
    base.alpha_composite(ring_layer)

    star_specs: Iterable[tuple[float, int, int, tuple[int, int, int, int]]] = (
        (0, 330, 28, (239, 208, 118, 255)),
        (45, 245, 19, (225, 192, 100, 240)),
        (90, 330, 28, (239, 208, 118, 255)),
        (135, 245, 19, (225, 192, 100, 240)),
        (180, 330, 28, (239, 208, 118, 255)),
        (225, 245, 19, (225, 192, 100, 240)),
        (270, 330, 28, (239, 208, 118, 255)),
        (315, 245, 19, (225, 192, 100, 240)),
    )
    for angle, length, width, color in star_specs:
        draw_star_point(
            base,
            angle=angle,
            length=length,
            width=width,
            color=color,
            glow_color=(74, 47, 4, 145),
        )

    draw_center_gem(base)

    trim = Image.new("RGBA", base.size, (0, 0, 0, 0))
    trim_draw = ImageDraw.Draw(trim)
    trim_draw.rounded_rectangle(
        (16, 16, CANVAS_SIZE - 16, CANVAS_SIZE - 16),
        radius=BACKGROUND_RADIUS,
        outline=(244, 218, 150, 120),
        width=8,
    )
    base.alpha_composite(trim)

    return apply_rounded_mask(base, BACKGROUND_RADIUS)


def save_outputs(icon: Image.Image) -> None:
    icon.save(MASTER_PNG)

    icon.save(
        WINDOWS_ICO,
        format="ICO",
        sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)],
    )

    icon.resize((256, 256), Image.Resampling.LANCZOS).save(FAVICON_PNG)
    icon.save(
        FAVICON_ICO,
        format="ICO",
        sizes=[(64, 64), (48, 48), (32, 32), (16, 16)],
    )


def main() -> None:
    ensure_dirs()
    icon = draw_icon()
    save_outputs(icon)
    print(f"Generated icon assets:\n- {MASTER_PNG}\n- {WINDOWS_ICO}\n- {FAVICON_PNG}\n- {FAVICON_ICO}")


if __name__ == "__main__":
    main()
