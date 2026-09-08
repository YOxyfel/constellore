"""Deterministic Pillow helper for planet-hub texture and image inspection."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter, ImageOps, ImageStat, __version__ as PILLOW_VERSION


SUPPORT_PROFILES = {
    "forge": {"roughness": 0.72, "metalness": 0.04},
    "earth-landing": {"roughness": 0.68, "metalness": 0.08},
    "moon-landing": {"roughness": 0.78, "metalness": 0.035},
    "portal": {"roughness": 0.58, "metalness": 0.12},
    "rocket": {"roughness": 0.46, "metalness": 0.24},
}

PLACE_THUMBNAIL_SOURCE_SIZE = (1983, 793)
PLACE_THUMBNAIL_ORDER = (
    # The source is a project-generated, horizontal portrait lineup. These
    # authored square crops keep each body readable in a 48 px Places card
    # without using runtime image processing or ten separate requests.
    ("sun", 132, 374, 278),
    ("mercury", 352, 374, 206),
    ("venus", 540, 374, 218),
    ("earth", 732, 372, 218),
    ("moon", 910, 374, 196),
    ("mars", 1088, 374, 220),
    ("jupiter", 1290, 373, 232),
    ("saturn", 1510, 372, 284),
    ("uranus", 1715, 373, 204),
    ("neptune", 1884, 373, 232),
)


def _pixels(image: Image.Image):
    return image.get_flattened_data()


def resize_directory(directory: Path, maximum: int) -> None:
    paths = sorted(
        path
        for path in directory.rglob("*")
        if path.is_file() and path.suffix.lower() in {".jpg", ".jpeg", ".png"}
    )
    for path in paths:
        with Image.open(path) as source:
            source.load()
            image = source
            if max(source.size) > maximum:
                ratio = maximum / max(source.size)
                size = tuple(max(1, round(value * ratio)) for value in source.size)
                image = source.resize(size, Image.Resampling.LANCZOS)
            if path.suffix.lower() in {".jpg", ".jpeg"}:
                image.convert("RGB").save(
                    path,
                    format="JPEG",
                    quality=82,
                    optimize=True,
                    progressive=True,
                    subsampling="4:2:0",
                )
            else:
                image.save(path, format="PNG", optimize=True, compress_level=9)


def inspect(path: Path) -> None:
    with Image.open(path) as image:
        image.load()
        rgba = image.convert("RGBA")
        alpha = rgba.getchannel("A")
        alpha_histogram = alpha.histogram()
        pixel_count = image.width * image.height
        luma = ImageStat.Stat(rgba.convert("L"))
        print(
            json.dumps(
                {
                    "width": image.width,
                    "height": image.height,
                    "format": image.format,
                    "hasAlpha": "A" in image.getbands(),
                    "lumaMean": round(luma.mean[0], 6),
                    "lumaStdDev": round(luma.stddev[0], 6),
                    "visiblePixelRatio": round(sum(alpha_histogram[16:]) / pixel_count, 6),
                    "opaquePixelRatio": round(sum(alpha_histogram[240:]) / pixel_count, 6),
                },
                separators=(",", ":"),
            )
        )


def _resize_exact(source: Image.Image, width: int, height: int) -> Image.Image:
    if source.size == (width, height):
        return source.copy()
    return source.resize((width, height), Image.Resampling.LANCZOS)


def _save_webp(image: Image.Image, output: Path, quality: int) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    image.save(
        output,
        format="WEBP",
        quality=quality,
        method=6,
        exact=True,
    )


def _smoothstep(value: float) -> float:
    amount = max(0.0, min(1.0, value))
    return amount * amount * (3.0 - 2.0 * amount)


def _make_horizontal_seam_compatible(image: Image.Image) -> Image.Image:
    """Blend paired wrap-edge texels without inventing a visible center seam."""
    rgb = image.convert("RGB")
    width, height = rgb.size
    seam_width = max(8, round(width * 0.018))
    left = rgb.crop((0, 0, seam_width, height))
    right = rgb.crop((width - seam_width, 0, width, height)).transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    shared = Image.blend(left, right, 0.5)
    mask = Image.new("L", (seam_width, 1))
    mask.putdata([
        round((1.0 - _smoothstep(index / max(1, seam_width - 1))) * 255)
        for index in range(seam_width)
    ])
    mask = mask.resize((seam_width, height))
    output = rgb.copy()
    output.paste(Image.composite(shared, left, mask), (0, 0))
    output.paste(
        Image.composite(shared, right, mask).transpose(Image.Transpose.FLIP_LEFT_RIGHT),
        (width - seam_width, 0),
    )
    return output


def _attenuate_equirectangular_poles(image: Image.Image) -> Image.Image:
    """Keep generated detail away from the UV poles where it would pinch."""
    rgb = image.convert("RGB")
    width, height = rgb.size
    pole_height = max(8, round(height * 0.085))
    minimum = 0.18
    values = []
    for y_value in range(height):
        edge_distance = min(y_value, height - 1 - y_value)
        amount = _smoothstep(edge_distance / max(1, pole_height - 1))
        values.append(round((minimum + (1.0 - minimum) * amount) * 255))
    mask = Image.new("L", (1, height))
    mask.putdata(values)
    mask = mask.resize((width, height))
    return Image.merge("RGB", tuple(ImageChops.multiply(channel, mask) for channel in rgb.split()))


def derive_space_layer(
    source_path: Path,
    output_path: Path,
    width: int,
    height: int,
    quality: int,
) -> None:
    if width != height * 2:
        raise ValueError("Space-layer output must use an exact 2:1 equirectangular aspect ratio")
    with Image.open(source_path) as opened:
        opened.load()
        source = opened.convert("RGB")
        if source.width != source.height * 2:
            source = ImageOps.fit(
                source,
                (source.height * 2, source.height),
                method=Image.Resampling.LANCZOS,
                centering=(0.5, 0.5),
            )
        image = _resize_exact(source, width, height)
        image = _make_horizontal_seam_compatible(image)
        image = _attenuate_equirectangular_poles(image)
        _save_webp(image, output_path, quality)


def derive_galaxy_texture(
    source_path: Path,
    output_path: Path,
    width: int,
    height: int,
    quality: int,
) -> None:
    if width != height:
        raise ValueError("Galaxy texture output must be square")
    with Image.open(source_path) as opened:
        opened.load()
        source = ImageOps.fit(
            opened.convert("RGB"),
            (width, height),
            method=Image.Resampling.LANCZOS,
            centering=(0.5, 0.5),
        )
        _save_webp(source, output_path, quality)


def derive_place_thumbnail_sprite(
    source_path: Path,
    output_path: Path,
    width: int,
    height: int,
    quality: int,
) -> None:
    if width != height * len(PLACE_THUMBNAIL_ORDER):
        raise ValueError("Places sprite width must contain ten square tiles")
    with Image.open(source_path) as opened:
        opened.load()
        if opened.size != PLACE_THUMBNAIL_SOURCE_SIZE:
            raise ValueError(
                "Places source dimensions changed; review authored crop anchors "
                f"(expected {PLACE_THUMBNAIL_SOURCE_SIZE}, received {opened.size})"
            )
        source = opened.convert("RGB")
        sprite = Image.new("RGB", (width, height), (0, 4, 12))
        edge_width = max(1, round(height * 0.13))
        edge_values = []
        for x_value in range(height):
            edge_distance = min(x_value, height - 1 - x_value)
            edge_values.append(round(_smoothstep(edge_distance / edge_width) * 255))
        edge_mask = Image.new("L", (height, 1))
        edge_mask.putdata(edge_values)
        edge_mask = edge_mask.resize((height, height))
        dark_space = Image.new("RGB", (height, height), (0, 4, 12))
        for index, (_name, center_x, center_y, crop_size) in enumerate(PLACE_THUMBNAIL_ORDER):
            half = crop_size / 2
            crop = source.crop((
                round(center_x - half),
                round(center_y - half),
                round(center_x + half),
                round(center_y + half),
            ))
            tile = ImageOps.fit(
                crop,
                (height, height),
                method=Image.Resampling.LANCZOS,
                centering=(0.5, 0.5),
            )
            # Adjacent bodies overlap a few authored crop windows. A narrow
            # black-space feather hides those neighbours and gives every CSS
            # tile a clean seam without cutting into the featured body.
            tile = Image.composite(tile, dark_space, edge_mask)
            sprite.paste(tile, (index * height, 0))
        _save_webp(sprite, output_path, quality)


def _derive_normal(source: Image.Image) -> Image.Image:
    # The albedo-only Tripo assets have no tangent-space detail maps. Use a
    # deliberately shallow Sobel response so focus lighting can reveal baked
    # high-frequency detail without turning color boundaries into deep relief.
    gray = ImageOps.grayscale(source)
    radius = max(0.55, min(source.size) / 900)
    height = gray.filter(ImageFilter.GaussianBlur(radius=radius))
    horizontal = height.filter(ImageFilter.Kernel(
        (3, 3), (-1, 0, 1, -2, 0, 2, -1, 0, 1), scale=8, offset=128
    ))
    vertical = height.filter(ImageFilter.Kernel(
        (3, 3), (-1, -2, -1, 0, 0, 0, 1, 2, 1), scale=8, offset=128
    ))
    pixels = []
    strength = 0.42
    for x_value, y_value in zip(_pixels(horizontal), _pixels(vertical)):
        x = ((x_value - 128) / 127) * strength
        y = -((y_value - 128) / 127) * strength
        length = math.sqrt(x * x + y * y + 1)
        pixels.append((
            round((x / length * 0.5 + 0.5) * 255),
            round((y / length * 0.5 + 0.5) * 255),
            round((1 / length * 0.5 + 0.5) * 255),
        ))
    output = Image.new("RGB", source.size)
    output.putdata(pixels)
    return output


def _derive_orm(source: Image.Image, role: str) -> Image.Image:
    profile = SUPPORT_PROFILES[role]
    rgb = source.convert("RGB")
    gray = ImageOps.grayscale(rgb)
    local = gray.filter(ImageFilter.GaussianBlur(radius=max(1.1, min(source.size) / 360)))
    saturation = rgb.convert("HSV").getchannel("S")
    pixels = []
    for luma, neighborhood, chroma in zip(_pixels(gray), _pixels(local), _pixels(saturation)):
        darkness = max(0, neighborhood - luma) / 255
        local_contrast = abs(luma - neighborhood) / 255
        saturation_amount = chroma / 255
        ao = max(0.68, min(1, 1 - darkness * 0.72))
        roughness = profile["roughness"] + (0.5 - saturation_amount) * 0.12 + local_contrast * 0.2
        roughness = max(0.34, min(0.92, roughness))
        # Chroma cannot identify metal reliably. Keep the authored-role prior
        # dominant and permit only a very small low-chroma highlight response.
        highlight = max(0, luma / 255 - 0.62)
        neutral = max(0, 0.48 - saturation_amount)
        metalness = profile["metalness"] + highlight * neutral * 0.16
        metalness = max(0, min(0.34, metalness))
        pixels.append((round(ao * 255), round(roughness * 255), round(metalness * 255)))
    output = Image.new("RGB", source.size)
    output.putdata(pixels)
    return output


def _derive_portal_emissive(source: Image.Image) -> Image.Image:
    rgb = source.convert("RGB")
    hsv = rgb.convert("HSV")
    saturation = hsv.getchannel("S")
    value = hsv.getchannel("V")
    pixels = []
    for color, chroma, brightness in zip(_pixels(rgb), _pixels(saturation), _pixels(value)):
        # Only bright, saturated portal pigment is defensible as emissive. The
        # soft threshold intentionally leaves stone and bronze nearly black.
        amount = max(0, min(1, (brightness / 255 - 0.52) / 0.34))
        amount *= max(0, min(1, (chroma / 255 - 0.2) / 0.55))
        amount *= 0.72
        pixels.append(tuple(round(channel * amount) for channel in color))
    output = Image.new("RGB", source.size)
    output.putdata(pixels)
    return output


def derive_texture(
    source_path: Path,
    output_path: Path,
    mode: str,
    width: int,
    height: int,
    role: str | None,
) -> None:
    with Image.open(source_path) as opened:
        opened.load()
        if mode == "clouds":
            image = _resize_exact(opened.convert("RGBA"), width, height)
            quality = 86
        else:
            image = _resize_exact(opened.convert("RGB"), width, height)
            if mode == "normal":
                image = _derive_normal(image)
                quality = 90
            elif mode == "orm":
                if role not in SUPPORT_PROFILES:
                    raise ValueError(f"Unsupported material-support role: {role}")
                image = _derive_orm(image, role)
                quality = 90
            elif mode == "portal-emissive":
                image = _derive_portal_emissive(image)
                quality = 88
            elif mode in {"night", "sun-emissive"}:
                quality = 86
            else:
                raise ValueError(f"Unsupported detail derivation mode: {mode}")
        _save_webp(image, output_path, quality)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=("version", "resize", "inspect", "derive", "space-layer", "galaxy-texture", "place-thumbnails"))
    parser.add_argument("path", nargs="?")
    parser.add_argument("output", nargs="?")
    parser.add_argument("--max", type=int, dest="maximum")
    parser.add_argument("--mode", choices=("clouds", "night", "sun-emissive", "normal", "orm", "portal-emissive"))
    parser.add_argument("--width", type=int)
    parser.add_argument("--height", type=int)
    parser.add_argument("--quality", type=int)
    parser.add_argument("--role", choices=tuple(SUPPORT_PROFILES))
    args = parser.parse_args()

    if args.command == "version":
        print(PILLOW_VERSION)
        return
    if not args.path:
        parser.error("path is required")
    if args.command == "resize":
        if not args.maximum or args.maximum < 1:
            parser.error("--max must be a positive integer")
        resize_directory(Path(args.path), args.maximum)
    elif args.command == "derive":
        if not args.output or not args.mode or not args.width or not args.height:
            parser.error("derive requires output, --mode, --width, and --height")
        derive_texture(Path(args.path), Path(args.output), args.mode, args.width, args.height, args.role)
    elif args.command == "space-layer":
        if not args.output or not args.width or not args.height or not args.quality:
            parser.error("space-layer requires output, --width, --height, and --quality")
        if not 1 <= args.quality <= 100:
            parser.error("--quality must be between 1 and 100")
        derive_space_layer(Path(args.path), Path(args.output), args.width, args.height, args.quality)
    elif args.command == "galaxy-texture":
        if not args.output or not args.width or not args.height or not args.quality:
            parser.error("galaxy-texture requires output, --width, --height, and --quality")
        if not 1 <= args.quality <= 100:
            parser.error("--quality must be between 1 and 100")
        derive_galaxy_texture(Path(args.path), Path(args.output), args.width, args.height, args.quality)
    elif args.command == "place-thumbnails":
        if not args.output or not args.width or not args.height or not args.quality:
            parser.error("place-thumbnails requires output, --width, --height, and --quality")
        if not 1 <= args.quality <= 100:
            parser.error("--quality must be between 1 and 100")
        derive_place_thumbnail_sprite(Path(args.path), Path(args.output), args.width, args.height, args.quality)
    else:
        inspect(Path(args.path))


if __name__ == "__main__":
    main()
