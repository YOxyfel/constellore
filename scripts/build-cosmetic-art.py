#!/usr/bin/env python3
"""Build responsive, on-demand cosmetic scene packs from approved PNG masters."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageOps


VARIANTS = {
    "home-sm.webp": ((960, 1280), 67),
    "home-md.webp": ((1920, 1080), 70),
    "home-lg.webp": ((2560, 1440), 76),
    "gate-sm.webp": ((1080, 1920), 72),
    "gate-md.webp": ((1920, 1080), 74),
    "gate-lg.webp": ((2560, 1440), 76),
}


def build_variant(
    source: Image.Image,
    size: tuple[int, int],
    quality: int,
    output: Path,
    *,
    centering: tuple[float, float] = (0.5, 0.5),
    resampling: Image.Resampling = Image.Resampling.LANCZOS,
) -> None:
    rendered = ImageOps.fit(
        source,
        size,
        method=resampling,
        centering=centering,
    )
    rendered.save(
        output,
        format="WEBP",
        quality=quality,
        method=6,
        exact=True,
        exif=b"",
        xmp=b"",
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--home-source", required=True, type=Path)
    parser.add_argument("--home-portrait-source", type=Path)
    parser.add_argument(
        "--home-portrait-center-y",
        type=float,
        default=0.5,
        help="Vertical crop focus for an optional portrait Home master (0=top, 1=bottom).",
    )
    parser.add_argument(
        "--home-portrait-quality-offset",
        type=int,
        default=0,
        help="Fine-tune only the mobile Home WebP quality for unusually detailed portrait art.",
    )
    parser.add_argument("--gate-source", required=True, type=Path)
    parser.add_argument("--gate-portrait-source", type=Path)
    parser.add_argument(
        "--gate-portrait-center-y",
        type=float,
        default=0.5,
        help="Vertical crop focus for an optional portrait Gate master (0=top, 1=bottom).",
    )
    parser.add_argument(
        "--gate-landscape-quality-offset",
        type=int,
        default=0,
        help="Fine-tune only the desktop Gate WebP quality for unusually detailed landscape art.",
    )
    parser.add_argument(
        "--quality-offset",
        type=int,
        default=0,
        help="Adjust every WebP quality value for unusually simple or detailed source art.",
    )
    parser.add_argument(
        "--pixelated",
        action="store_true",
        help="Resize with nearest-neighbor sampling to preserve deliberate pixel-art edges.",
    )
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    if not 0.0 <= args.home_portrait_center_y <= 1.0:
        parser.error("--home-portrait-center-y must be between 0 and 1.")
    if not 0.0 <= args.gate_portrait_center_y <= 1.0:
        parser.error("--gate-portrait-center-y must be between 0 and 1.")
    if not -30 <= args.quality_offset <= 15:
        parser.error("--quality-offset must be between -30 and 15.")
    if not -30 <= args.home_portrait_quality_offset <= 15:
        parser.error("--home-portrait-quality-offset must be between -30 and 15.")
    if not -30 <= args.gate_landscape_quality_offset <= 15:
        parser.error("--gate-landscape-quality-offset must be between -30 and 15.")

    def adjusted_quality(quality: int, local_offset: int = 0) -> int:
        return max(35, min(90, quality + args.quality_offset + local_offset))

    resampling = Image.Resampling.NEAREST if args.pixelated else Image.Resampling.LANCZOS

    args.output.mkdir(parents=True, exist_ok=True)
    with Image.open(args.home_source) as home_image:
        home = home_image.convert("RGB")
        for filename, (size, quality) in VARIANTS.items():
            if not filename.startswith("home-") or (
                filename == "home-sm.webp" and args.home_portrait_source
            ):
                continue
            build_variant(
                home,
                size,
                adjusted_quality(quality),
                args.output / filename,
                resampling=resampling,
            )

    if args.home_portrait_source:
        with Image.open(args.home_portrait_source) as portrait_image:
            portrait = portrait_image.convert("RGB")
            size, quality = VARIANTS["home-sm.webp"]
            build_variant(
                portrait,
                size,
                adjusted_quality(quality, args.home_portrait_quality_offset),
                args.output / "home-sm.webp",
                centering=(0.5, args.home_portrait_center_y),
                resampling=resampling,
            )

    with Image.open(args.gate_source) as gate_image:
        gate = gate_image.convert("RGB")
        for filename, (size, quality) in VARIANTS.items():
            if not filename.startswith("gate-") or (
                filename == "gate-sm.webp" and args.gate_portrait_source
            ):
                continue
            build_variant(
                gate,
                size,
                adjusted_quality(quality, args.gate_landscape_quality_offset),
                args.output / filename,
                resampling=resampling,
            )

    if args.gate_portrait_source:
        with Image.open(args.gate_portrait_source) as portrait_image:
            portrait = portrait_image.convert("RGB")
            size, quality = VARIANTS["gate-sm.webp"]
            build_variant(
                portrait,
                size,
                adjusted_quality(quality),
                args.output / "gate-sm.webp",
                centering=(0.5, args.gate_portrait_center_y),
                resampling=resampling,
            )

    for filename, (expected_size, _) in VARIANTS.items():
        output = args.output / filename
        with Image.open(output) as rendered:
            if rendered.size != expected_size or rendered.format != "WEBP":
                raise RuntimeError(
                    f"{output} is {rendered.size}/{rendered.format}; "
                    f"expected {expected_size}/WEBP"
                )
        print(f"{output}: {output.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
