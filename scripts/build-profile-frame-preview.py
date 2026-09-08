#!/usr/bin/env python3
"""Validate profile-frame masters and build deterministic review sheets."""

from __future__ import annotations

from pathlib import Path
from typing import Final

from PIL import Image, ImageChops, ImageDraw, ImageFont


PROJECT_ROOT: Final = Path(__file__).resolve().parents[1]
FRAME_DIR: Final = PROJECT_ROOT / "public" / "art" / "profile-frames"
OUTPUT_PATH: Final = (
    PROJECT_ROOT / "itch-assets" / "profile-frames" / "profile-frame-contact-sheet.png"
)
PARTIAL_OUTPUT_PATH: Final = (
    PROJECT_ROOT / "itch-assets" / "profile-frames" / "partial-overlay-contact-sheet.png"
)
PLACEMENT_PUBLIC_PATH: Final = (
    PROJECT_ROOT / "public" / "art" / "profile-frame-placement-variations.png"
)
PLACEMENT_REVIEW_PATH: Final = (
    PROJECT_ROOT / "itch-assets" / "profile-frames" / "partial-placement-variations.png"
)

FRAMES: Final = (
    ("berry-burrow", "Berry Burrow", "Strawberry Bunnies", False, (.175, .095, .075, .095)),
    ("lunar-reverie", "Lunar Reverie", "Celestial Moon & Stars", True, (.05, .065, .05, .065)),
    ("eventide-fracture", "Eventide Fracture", "Black-Hole Kintsugi", True, (.14, .09, .07, .09)),
    ("verdant-reliquary", "Verdant Reliquary", "Enchanted Ivy Ruins", False, (.195, .14, .105, .14)),
    ("ember-sovereign", "Ember Sovereign", "Fire Dragon", True, (.145, .095, .045, .095)),
    ("abyssal-pearl", "Abyssal Pearl", "Ocean Pearls & Jellyfish", True, (.145, .135, .115, .135)),
    ("chromatic-override", "Chromatic Override", "Neon Cyberpunk", False, (.165, .145, .11, .145)),
    ("maple-hearth", "Maple Hearth", "Autumn Foxes", False, (.055, .045, .05, .045)),
    ("frostbound-crown", "Frostbound Crown", "Winter Crystals", False, (.165, .145, .105, .145)),
    ("keeper-of-tomes", "Keeper of Tomes", "Arcane Library", False, (.165, .125, .20, .125)),
    ("tidal-ascendant", "Tidal Ascendant", "Leviathan Tide", False, (.04, .04, .04, .04)),
    ("storm-seraph", "Storm Seraph", "Thunderbird Tempest", False, (.04, .04, .04, .04)),
    ("empyrean-ascension", "Empyrean Ascension", "Seraphic Dawn", False, (.04, .04, .04, .04)),
    ("infernal-dominion", "Infernal Dominion", "Horned Inferno", False, (.04, .04, .04, .04)),
    ("eclipse-omen", "Eclipse Omen", "Black-Sun Prophecy", False, (.04, .04, .04, .04)),
    ("runebreaker-awakening", "Runebreaker Awakening", "Arcane Rupture", False, (.04, .04, .04, .04)),
    ("mecha-singularity", "Mecha Singularity", "Holographic Reactor", False, (.04, .04, .04, .04)),
    ("titanfall-relic", "Titanfall Relic", "Colossus Kintsugi", False, (.04, .04, .04, .04)),
    ("starforged-ronin", "Starforged Ronin", "Moonsteel Oath", False, (.04, .04, .04, .04)),
    ("gravebound-king", "Gravebound King", "Emerald Requiem", False, (.04, .04, .04, .04)),
)

TILE_WIDTH: Final = 360
TILE_HEIGHT: Final = 530
FRAME_WIDTH: Final = 300
FRAME_HEIGHT: Final = 400
CONTENT_INSET_FRACTIONS: Final = {
    "lunar-reverie": .0725,
    "maple-hearth": .102,
    "tidal-ascendant": .20,
    "storm-seraph": .20,
    "empyrean-ascension": .20,
    "infernal-dominion": .20,
    "eclipse-omen": .20,
    "runebreaker-awakening": .20,
    "mecha-singularity": .20,
    "titanfall-relic": .20,
    "starforged-ronin": .20,
    "gravebound-king": .20,
}
AVATAR_TOP_FRACTIONS: Final = {
    "lunar-reverie": .27,
    "maple-hearth": .255,
    "tidal-ascendant": .35,
    "storm-seraph": .35,
    "empyrean-ascension": .35,
    "infernal-dominion": .35,
    "eclipse-omen": .35,
    "runebreaker-awakening": .35,
    "mecha-singularity": .35,
    "titanfall-relic": .35,
    "starforged-ronin": .35,
    "gravebound-king": .35,
}
PARTIAL_SLUGS: Final = frozenset({
    "tidal-ascendant",
    "storm-seraph",
    "empyrean-ascension",
    "infernal-dominion",
    "eclipse-omen",
    "runebreaker-awakening",
    "mecha-singularity",
    "titanfall-relic",
    "starforged-ronin",
    "gravebound-king",
})
PLACEMENT_VARIANTS: Final = (
    ("01", "CURRENT", "Original overlap", ((0., 0.), (0., 0.), (0., 0.))),
    ("02", "LIGHT HANG", "About 30% outside", ((-.050, -.050), (.075, 0.), (-.042, .042))),
    ("03", "BALANCED", "About 55% outside", ((-.080, -.080), (.120, 0.), (-.076, .076))),
    ("04", "MOSTLY OUTSIDE", "About 80% outside", ((-.117, -.117), (.187, 0.), (-.118, .118))),
    ("05", "OUTERMOST", "Only a slight overlap", ((-.151, -.151), (.274, 0.), (-.150, .150))),
)
TIDAL_CLUSTER_ZONES: Final = (
    (0.00, 0.00, 0.62, 0.50),
    (0.55, 0.22, 1.00, 0.72),
    (0.00, 0.64, 0.52, 1.00),
)
PARTIAL_MASTER_WIDTH: Final = 1086
PARTIAL_MASTER_HEIGHT: Final = 1448
PARTIAL_ISLANDS: Final = {
    "tidal-ascendant": (
        ("outside", (35, 36, 550, 524), (-126, -167)),
        ("card", (702, 446, 1056, 898), (211, 0)),
        ("outside", (32, 1079, 370, 1429), (-126, 167)),
    ),
    "storm-seraph": (
        ("outside", (228, 41, 1056, 685), (235, -313)),
        ("card", (53, 417, 303, 1149), (-135, 0)),
        ("outside", (553, 890, 1052, 1387), (218, 290)),
    ),
    "empyrean-ascension": (
        ("outside", (16, 64, 382, 835), (-190, 140)),
        ("outside", (701, 65, 1067, 835), (190, 140)),
        ("card", (330, 868, 757, 1270), (0, -820)),
    ),
    "infernal-dominion": (
        ("outside", (24, 62, 399, 908), (-190, 100)),
        ("outside", (687, 62, 1062, 908), (190, 100)),
        ("card", (234, 906, 851, 1360), (0, -865)),
    ),
    "eclipse-omen": (
        ("outside", (538, 22, 1071, 518), (150, -201)),
        ("card", (25, 373, 221, 1034), (-48, 0)),
        ("outside", (633, 1007, 1060, 1423), (74, 98)),
    ),
    "runebreaker-awakening": (
        ("outside", (16, 27, 524, 519), (-197, -263)),
        ("card", (807, 392, 1065, 962), (106, 0)),
        ("outside", (34, 931, 407, 1421), (-153, 205)),
    ),
    "mecha-singularity": (
        ("outside", (61, 82, 497, 509), (-208, -278)),
        ("card", (762, 400, 1008, 1042), (151, 0)),
        ("outside", (54, 974, 502, 1380), (-178, 238)),
    ),
    "titanfall-relic": (
        ("outside", (549, 44, 1034, 555), (171, -229)),
        ("card", (66, 461, 352, 1000), (-179, 0)),
        ("outside", (531, 977, 1047, 1391), (199, 265)),
    ),
    "starforged-ronin": (
        ("outside", (19, 70, 550, 686), (-360, -160)),
        ("card", (570, 47, 1066, 900), (300, -50)),
        ("outside", (258, 824, 802, 1384), (180, 300)),
    ),
    "gravebound-king": (
        ("outside", (24, 35, 497, 550), (800, -330)),
        ("card", (682, 49, 1038, 749), (188, 240)),
        ("outside", (393, 843, 691, 1414), (-460, 280)),
    ),
}
PARTIAL_ISLAND_SHAPES: Final = {
    ("storm-seraph", 0): (
        (228, 41),
        (1056, 41),
        (1056, 685),
        (338, 685),
        (338, 528),
        (228, 528),
    ),
}


def font(path: str, size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidate = Path("C:/Windows/Fonts") / path
    if candidate.exists():
        return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default()


TITLE_FONT = font("segoeuib.ttf", 19)
SUBTITLE_FONT = font("segoeui.ttf", 12)
BADGE_FONT = font("segoeuib.ttf", 10)
CARD_TITLE_FONT = font("segoeuib.ttf", 15)
CARD_COPY_FONT = font("segoeui.ttf", 10)
VARIANT_NUMBER_FONT = font("segoeuib.ttf", 28)
VARIANT_TITLE_FONT = font("segoeuib.ttf", 18)


def validate_frame(image: Image.Image, slug: str) -> None:
    if image.mode != "RGBA":
        raise ValueError(f"{slug}: expected RGBA, got {image.mode}")
    width, height = image.size
    if width * 4 != height * 3:
        raise ValueError(f"{slug}: expected exact 3:4 ratio, got {width}x{height}")

    alpha = image.getchannel("A")
    probes = (
        (0, 0),
        (width - 1, 0),
        (0, height - 1),
        (width - 1, height - 1),
        (width // 2, height // 2),
    )
    if any(alpha.getpixel(point) != 0 for point in probes):
        raise ValueError(f"{slug}: corners and exact center must be transparent")

    if slug not in PARTIAL_SLUGS:
        safe_box = (
            round(width * 0.34),
            round(height * 0.36),
            round(width * 0.66),
            round(height * 0.66),
        )
        if alpha.crop(safe_box).getbbox() is not None:
            raise ValueError(f"{slug}: central content-safe region is obstructed")


def card_surface(
    slug: str,
    fit: tuple[float, float, float, float],
) -> tuple[Image.Image, Image.Image]:
    image = Image.new("RGBA", (FRAME_WIDTH, FRAME_HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image, "RGBA")
    top_fraction, right_fraction, bottom_fraction, left_fraction = fit
    card_left = round(FRAME_WIDTH * left_fraction)
    card_top = round(FRAME_HEIGHT * top_fraction)
    card_right = FRAME_WIDTH - round(FRAME_WIDTH * right_fraction)
    card_bottom = FRAME_HEIGHT - round(FRAME_HEIGHT * bottom_fraction)
    card_width = card_right - card_left
    card_height = card_bottom - card_top
    bounds = (
        card_left,
        card_top,
        card_right,
        card_bottom,
    )
    draw.rounded_rectangle(
        bounds,
        radius=25,
        fill=(21, 25, 37, 255),
        outline=(117, 132, 163, 75),
        width=1,
    )
    banner_bottom = card_top + round(card_height * .32)
    banner = (
        card_left + 1,
        card_top + 1,
        card_right - 1,
        banner_bottom,
    )
    draw.rounded_rectangle(
        banner,
        radius=24,
        fill=(36, 31, 72, 255),
    )
    draw.rectangle(
        (card_left + 1, banner_bottom - 22, card_right - 1, banner_bottom),
        fill=(36, 31, 72, 255),
    )
    star_width = max(1, card_width - 28)
    star_height = max(1, round(card_height * .27))
    for index in range(20):
        x = card_left + 14 + ((index * 47) % star_width)
        y = card_top + 8 + ((index * 31) % star_height)
        radius = 1 if index % 3 else 2
        draw.ellipse((x, y, x + radius, y + radius), fill=(237, 236, 255, 115))

    content = Image.new("RGBA", (FRAME_WIDTH, FRAME_HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(content, "RGBA")
    avatar_size = min(52, round(card_width * .25))
    content_inset = round(
        card_width * CONTENT_INSET_FRACTIONS.get(slug, 17 / card_width)
    )
    avatar_left = (
        card_left + (card_width - avatar_size) // 2
        if slug in PARTIAL_SLUGS
        else card_left + content_inset
    )
    avatar_top = card_top + round(
        card_height * AVATAR_TOP_FRACTIONS.get(slug, .22)
    )
    avatar = (
        avatar_left,
        avatar_top,
        avatar_left + avatar_size,
        avatar_top + avatar_size,
    )
    draw.ellipse(avatar, fill=(77, 70, 129, 255), outline=(236, 215, 143, 255), width=3)
    draw.text(
        (avatar_left + round(avatar_size * .32), avatar_top + round(avatar_size * .18)),
        "W",
        font=TITLE_FONT,
        fill=(255, 246, 215, 255),
    )
    status_size = 14
    status_left = avatar_left + avatar_size - status_size + 1
    status_top = avatar_top + avatar_size - status_size + 1
    draw.ellipse(
        (status_left, status_top, status_left + status_size, status_top + status_size),
        fill=(86, 205, 143, 255),
        outline=(21, 25, 37, 255),
        width=3,
    )

    text_left = card_left + content_inset
    rank_y = card_top + round(
        card_height * (.50 if slug in PARTIAL_SLUGS else .44)
    )
    title_y = rank_y + 17
    copy_y = title_y + 23
    rule_y = card_top + round(card_height * .64)
    facts_y = rule_y + 9
    second_column = card_left + round(card_width * .56)
    if slug in PARTIAL_SLUGS:
        center_x = card_left + card_width // 2
        first_column = card_left + round(card_width * .30)
        second_column = card_left + round(card_width * .70)
        draw.text((center_x, rank_y), "WAYFINDER · RANK 06", font=BADGE_FONT, fill=(225, 194, 124, 255), anchor="mt")
        draw.text((center_x, title_y), "Nova Cartographer", font=CARD_TITLE_FONT, fill=(247, 245, 239, 255), anchor="mt")
        draw.text((center_x, copy_y), "Mapping impossible connections", font=CARD_COPY_FONT, fill=(168, 178, 197, 255), anchor="mt")
        draw.text((center_x, copy_y + 14), "across a living universe.", font=CARD_COPY_FONT, fill=(168, 178, 197, 255), anchor="mt")
        draw.line((text_left, rule_y, card_right - content_inset, rule_y), fill=(255, 255, 255, 25), width=1)
        draw.text((first_column, facts_y), "184", font=CARD_TITLE_FONT, fill=(244, 241, 233, 255), anchor="mt")
        draw.text((first_column, facts_y + 20), "DISCOVERIES", font=BADGE_FONT, fill=(129, 142, 163, 255), anchor="mt")
        draw.text((second_column, facts_y), "12", font=CARD_TITLE_FONT, fill=(244, 241, 233, 255), anchor="mt")
        draw.text((second_column, facts_y + 20), "CONSTELLATIONS", font=BADGE_FONT, fill=(129, 142, 163, 255), anchor="mt")
    else:
        draw.text((text_left, rank_y), "WAYFINDER · RANK 06", font=BADGE_FONT, fill=(225, 194, 124, 255))
        draw.text((text_left, title_y), "Nova Cartographer", font=CARD_TITLE_FONT, fill=(247, 245, 239, 255))
        draw.text((text_left, copy_y), "Mapping impossible connections", font=CARD_COPY_FONT, fill=(168, 178, 197, 255))
        draw.text((text_left, copy_y + 14), "across a living universe.", font=CARD_COPY_FONT, fill=(168, 178, 197, 255))
        draw.line((text_left, rule_y, card_right - 17, rule_y), fill=(255, 255, 255, 25), width=1)
        draw.text((text_left, facts_y), "184", font=CARD_TITLE_FONT, fill=(244, 241, 233, 255))
        draw.text((text_left, facts_y + 20), "DISCOVERIES", font=BADGE_FONT, fill=(129, 142, 163, 255))
        draw.text((second_column, facts_y), "12", font=CARD_TITLE_FONT, fill=(244, 241, 233, 255))
        draw.text((second_column, facts_y + 20), "CONSTELLATIONS", font=BADGE_FONT, fill=(129, 142, 163, 255))
    return image, content


def render_sheet(
    frames: tuple,
    columns: int,
    output_path: Path,
) -> None:
    rows = (len(frames) + columns - 1) // columns
    sheet = Image.new(
        "RGB",
        (columns * TILE_WIDTH, rows * TILE_HEIGHT),
        (7, 9, 16),
    )
    draw = ImageDraw.Draw(sheet, "RGBA")

    for index, (slug, title, subtitle, animated, fit) in enumerate(frames):
        source = Image.open(FRAME_DIR / f"{slug}.png").convert("RGBA")
        validate_frame(source, slug)
        resized = source.resize((FRAME_WIDTH, FRAME_HEIGHT), Image.Resampling.LANCZOS)
        preview, content = card_surface(slug, fit)
        if slug not in PARTIAL_SLUGS:
            preview.alpha_composite(content)
        preview.alpha_composite(resized)
        if slug in PARTIAL_SLUGS:
            preview.alpha_composite(content)

        column = index % columns
        row = index // columns
        origin_x = column * TILE_WIDTH
        origin_y = row * TILE_HEIGHT
        draw.rounded_rectangle(
            (origin_x + 8, origin_y + 8, origin_x + TILE_WIDTH - 8, origin_y + TILE_HEIGHT - 8),
            radius=22,
            fill=(14, 18, 29, 255),
            outline=(194, 216, 255, 27),
            width=1,
        )
        sheet.paste(preview, (origin_x + 30, origin_y + 18), preview)
        draw.text((origin_x + 27, origin_y + 436), subtitle.upper(), font=BADGE_FONT, fill=(221, 190, 119, 255))
        draw.text((origin_x + 27, origin_y + 457), title, font=TITLE_FONT, fill=(246, 242, 231, 255))
        if animated or slug in PARTIAL_SLUGS:
            badge_bounds = (
                origin_x + TILE_WIDTH - 92,
                origin_y + 451,
                origin_x + TILE_WIDTH - 26,
                origin_y + 473,
            )
            draw.rounded_rectangle(
                badge_bounds,
                radius=11,
                fill=(105, 86, 205, 95),
                outline=(161, 144, 244, 100),
                width=1,
            )
            draw.text(
                (badge_bounds[0] + 10, badge_bounds[1] + 5),
                "ANIMATED" if animated else "PARTIAL",
                font=BADGE_FONT,
                fill=(224, 218, 255, 255),
            )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output_path, optimize=True)
    print(f"Wrote {output_path}")


def paste_partial_islands(
    canvas: Image.Image,
    source: Image.Image,
    fit: tuple[float, float, float, float],
    origin: tuple[int, int],
    slug: str,
) -> None:
    resized = source.resize((FRAME_WIDTH, FRAME_HEIGHT), Image.Resampling.LANCZOS)
    outside_layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    card_layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    origin_x, origin_y = origin

    for island_index, (plane, bounds, offset) in enumerate(PARTIAL_ISLANDS[slug]):
        left, top, right, bottom = bounds
        scaled_bounds = (
            round(left * FRAME_WIDTH / PARTIAL_MASTER_WIDTH),
            round(top * FRAME_HEIGHT / PARTIAL_MASTER_HEIGHT),
            round(right * FRAME_WIDTH / PARTIAL_MASTER_WIDTH),
            round(bottom * FRAME_HEIGHT / PARTIAL_MASTER_HEIGHT),
        )
        cluster = resized.crop(scaled_bounds)
        shape = PARTIAL_ISLAND_SHAPES.get((slug, island_index))
        if shape:
            cluster_mask = Image.new("L", cluster.size, 0)
            ImageDraw.Draw(cluster_mask).polygon(
                [
                    (
                        round((point_x - left) * FRAME_WIDTH / PARTIAL_MASTER_WIDTH),
                        round((point_y - top) * FRAME_HEIGHT / PARTIAL_MASTER_HEIGHT),
                    )
                    for point_x, point_y in shape
                ],
                fill=255,
            )
            cluster.putalpha(
                ImageChops.multiply(cluster.getchannel("A"), cluster_mask)
            )
        offset_x = round(offset[0] * FRAME_WIDTH / PARTIAL_MASTER_WIDTH)
        offset_y = round(offset[1] * FRAME_HEIGHT / PARTIAL_MASTER_HEIGHT)
        destination = (
            origin_x + scaled_bounds[0] + offset_x,
            origin_y + scaled_bounds[1] + offset_y,
        )
        target = card_layer if plane == "card" else outside_layer
        target.alpha_composite(cluster, destination)

    top_fraction, right_fraction, bottom_fraction, left_fraction = fit
    card_mask = Image.new("L", canvas.size, 0)
    mask_draw = ImageDraw.Draw(card_mask)
    mask_draw.rounded_rectangle(
        (
            origin_x + round(FRAME_WIDTH * left_fraction) + 1,
            origin_y + round(FRAME_HEIGHT * top_fraction) + 1,
            origin_x + FRAME_WIDTH - round(FRAME_WIDTH * right_fraction) - 1,
            origin_y + FRAME_HEIGHT - round(FRAME_HEIGHT * bottom_fraction) - 1,
        ),
        radius=20,
        fill=255,
    )
    card_layer.putalpha(
        ImageChops.multiply(card_layer.getchannel("A"), card_mask)
    )
    canvas.alpha_composite(outside_layer)
    canvas.alpha_composite(card_layer)


def render_partial_sheet(frames: tuple, output_path: Path) -> None:
    tile_width = 580
    tile_height = 690
    columns = 3
    rows = (len(frames) + columns - 1) // columns
    stage_x = 140
    stage_y = 96
    sheet = Image.new(
        "RGB",
        (columns * tile_width, rows * tile_height),
        (7, 9, 16),
    )

    for index, (slug, title, subtitle, _animated, fit) in enumerate(frames):
        source = Image.open(FRAME_DIR / f"{slug}.png").convert("RGBA")
        validate_frame(source, slug)
        tile = Image.new("RGBA", (tile_width, tile_height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(tile, "RGBA")
        draw.rounded_rectangle(
            (8, 8, tile_width - 8, tile_height - 8),
            radius=24,
            fill=(14, 18, 29, 255),
            outline=(194, 216, 255, 32),
            width=1,
        )
        base, content = card_surface(slug, fit)
        tile.alpha_composite(base, (stage_x, stage_y))
        paste_partial_islands(tile, source, fit, (stage_x, stage_y), slug)
        tile.alpha_composite(content, (stage_x, stage_y))
        draw.text(
            (28, 605),
            subtitle.upper(),
            font=BADGE_FONT,
            fill=(221, 190, 119, 255),
        )
        draw.text(
            (28, 628),
            title,
            font=TITLE_FONT,
            fill=(246, 242, 231, 255),
        )
        draw.text(
            (28, 656),
            "TWO OUTSIDE / ONE CARD-CLIPPED",
            font=SUBTITLE_FONT,
            fill=(145, 157, 177, 255),
        )

        origin = (
            (index % columns) * tile_width,
            (index // columns) * tile_height,
        )
        sheet.paste(tile, origin, tile)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output_path, optimize=True)
    print(f"Wrote {output_path}")


def draw_dashed_rectangle(
    draw: ImageDraw.ImageDraw,
    bounds: tuple[int, int, int, int],
) -> None:
    left, top, right, bottom = bounds
    color = (164, 204, 255, 130)
    dash = 7
    gap = 5
    for x in range(left, right, dash + gap):
        draw.line((x, top, min(x + dash, right), top), fill=color, width=1)
        draw.line((x, bottom, min(x + dash, right), bottom), fill=color, width=1)
    for y in range(top, bottom, dash + gap):
        draw.line((left, y, left, min(y + dash, bottom)), fill=color, width=1)
        draw.line((right, y, right, min(y + dash, bottom)), fill=color, width=1)


def build_placement_variations() -> None:
    tile_width = 580
    tile_height = 690
    columns = 3
    rows = 2
    stage_x = 140
    stage_y = 100
    sheet = Image.new(
        "RGB",
        (columns * tile_width, rows * tile_height),
        (7, 9, 16),
    )
    tidal = Image.open(FRAME_DIR / "tidal-ascendant.png").convert("RGBA")
    tidal = tidal.resize((FRAME_WIDTH, FRAME_HEIGHT), Image.Resampling.LANCZOS)

    for index, (number, title, subtitle, offsets) in enumerate(PLACEMENT_VARIANTS):
        tile = Image.new(
            "RGBA",
            (tile_width, tile_height),
            (0, 0, 0, 0),
        )
        draw = ImageDraw.Draw(tile, "RGBA")
        draw.rounded_rectangle(
            (8, 8, tile_width - 8, tile_height - 8),
            radius=24,
            fill=(14, 18, 29, 255),
            outline=(194, 216, 255, 32),
            width=1,
        )
        base, content = card_surface(
            "tidal-ascendant",
            (.04, .04, .04, .04),
        )
        tile.alpha_composite(base, (stage_x, stage_y))

        for zone, (dx, dy) in zip(TIDAL_CLUSTER_ZONES, offsets):
            left = round(FRAME_WIDTH * zone[0])
            top = round(FRAME_HEIGHT * zone[1])
            right = round(FRAME_WIDTH * zone[2])
            bottom = round(FRAME_HEIGHT * zone[3])
            cluster = tidal.crop((left, top, right, bottom))
            destination = (
                stage_x + left + round(FRAME_WIDTH * dx),
                stage_y + top + round(FRAME_HEIGHT * dy),
            )
            tile.alpha_composite(cluster, destination)

        tile.alpha_composite(content, (stage_x, stage_y))
        draw_dashed_rectangle(
            draw,
            (
                stage_x + round(FRAME_WIDTH * .04),
                stage_y + round(FRAME_HEIGHT * .04),
                stage_x + round(FRAME_WIDTH * .96),
                stage_y + round(FRAME_HEIGHT * .96),
            ),
        )
        draw.text(
            (28, 605),
            number,
            font=VARIANT_NUMBER_FONT,
            fill=(232, 199, 126, 255),
        )
        draw.text(
            (78, 608),
            title,
            font=VARIANT_TITLE_FONT,
            fill=(246, 242, 231, 255),
        )
        draw.text(
            (79, 635),
            subtitle,
            font=SUBTITLE_FONT,
            fill=(145, 157, 177, 255),
        )
        draw.text(
            (79, 656),
            "Dashed line = card border",
            font=SUBTITLE_FONT,
            fill=(145, 157, 177, 255),
        )

        origin = (
            (index % columns) * tile_width,
            (index // columns) * tile_height,
        )
        sheet.paste(tile, origin, tile)

    guide = Image.new(
        "RGBA",
        (tile_width, tile_height),
        (0, 0, 0, 0),
    )
    guide_draw = ImageDraw.Draw(guide, "RGBA")
    guide_draw.rounded_rectangle(
        (8, 8, tile_width - 8, tile_height - 8),
        radius=24,
        fill=(14, 18, 29, 255),
        outline=(194, 216, 255, 32),
        width=1,
    )
    guide_draw.text(
        (64, 236),
        "PICK 01–05",
        font=VARIANT_NUMBER_FONT,
        fill=(232, 199, 126, 255),
    )
    guide_draw.text(
        (65, 286),
        "The selected displacement will be mapped",
        font=VARIANT_TITLE_FONT,
        fill=(246, 242, 231, 255),
    )
    guide_draw.text(
        (65, 316),
        "to all ten three-cluster overlays.",
        font=VARIANT_TITLE_FONT,
        fill=(246, 242, 231, 255),
    )
    guide_draw.text(
        (65, 365),
        "01 = current overlap · 05 = almost fully outside",
        font=SUBTITLE_FONT,
        fill=(145, 157, 177, 255),
    )
    sheet.paste(
        guide,
        (2 * tile_width, tile_height),
        guide,
    )

    for output_path in (PLACEMENT_PUBLIC_PATH, PLACEMENT_REVIEW_PATH):
        output_path.parent.mkdir(parents=True, exist_ok=True)
        sheet.save(output_path, optimize=True)
        print(f"Wrote {output_path}")


def build_sheet() -> None:
    render_sheet(FRAMES, 4, OUTPUT_PATH)
    partial_frames = tuple(
        frame for frame in FRAMES
        if frame[0] in PARTIAL_SLUGS
    )
    render_partial_sheet(partial_frames, PARTIAL_OUTPUT_PATH)
    build_placement_variations()


if __name__ == "__main__":
    build_sheet()
