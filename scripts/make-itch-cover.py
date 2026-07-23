from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "itch-assets"
SOURCE = ASSET_DIR / "source" / "cover-source-art.png"
OUTPUT = ASSET_DIR / "constellore-cover-630x500.png"


def tracking_width(text, font, spacing):
    return sum(font.getlength(character) for character in text) + spacing * max(0, len(text) - 1)


def render_cover():
    image = Image.open(SOURCE).convert("RGBA")
    target_ratio = 630 / 500
    ratio = image.width / image.height

    if ratio < target_ratio:
        crop_height = round(image.width / target_ratio)
        image = image.crop((0, 0, image.width, crop_height))
    else:
        crop_width = round(image.height * target_ratio)
        left = (image.width - crop_width) // 2
        image = image.crop((left, 0, left + crop_width, image.height))

    image = image.resize((1260, 1000), Image.Resampling.LANCZOS)

    # Keep the generated cosmic artwork intact while quieting the title area.
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    pixels = overlay.load()
    for y in range(520):
        amount = y / 520
        alpha = round(142 * (1 - amount) ** 1.7)
        for x in range(1260):
            pixels[x, y] = (4, 6, 16, alpha)
    image = Image.alpha_composite(image, overlay)

    mono_path = r"C:\Windows\Fonts\CascadiaMono.ttf"
    title_path = r"C:\Windows\Fonts\segoeuib.ttf"
    studio_font = ImageFont.truetype(mono_path, 27)
    title_font = ImageFont.truetype(title_path, 116)
    tagline_font = ImageFont.truetype(mono_path, 29)

    def tracking_mask(text, font, spacing, y, blur=0):
        mask = Image.new("L", image.size, 0)
        draw = ImageDraw.Draw(mask)
        x = (image.width - tracking_width(text, font, spacing)) / 2
        for character in text:
            draw.text((round(x), y), character, font=font, fill=255, anchor="lt")
            x += font.getlength(character) + spacing
        return mask.filter(ImageFilter.GaussianBlur(blur)) if blur else mask

    def draw_tracking(text, font, spacing, y, color, glow=None):
        if glow:
            glow_color, radius, opacity = glow
            glow_mask = tracking_mask(text, font, spacing, y, blur=radius).point(
                lambda value: value * opacity // 255
            )
            glow_layer = Image.new("RGBA", image.size, glow_color)
            image.alpha_composite(Image.composite(glow_layer, Image.new("RGBA", image.size), glow_mask))

        layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(layer)
        x = (image.width - tracking_width(text, font, spacing)) / 2
        for character in text:
            draw.text((round(x), y), character, font=font, fill=color, anchor="lt")
            x += font.getlength(character) + spacing
        image.alpha_composite(layer)

    draw = ImageDraw.Draw(image)
    draw.ellipse((617, 54, 643, 80), outline=(170, 140, 255, 150), width=2)
    draw.line((630, 59, 630, 75), fill=(105, 230, 255, 190), width=2)
    draw.line((622, 67, 638, 67), fill=(170, 140, 255, 220), width=2)

    draw_tracking("OXYFEL GAMES", studio_font, 6, 87, (174, 178, 198, 255))
    draw_tracking(
        "CONSTELLORE",
        title_font,
        5,
        126,
        (247, 244, 255, 255),
        glow=((130, 94, 225, 145), 15, 150),
    )
    draw_tracking(
        "BUILD A UNIVERSE. FIND THE WORD.",
        tagline_font,
        1.5,
        278,
        (118, 228, 255, 255),
    )

    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle(
        (18, 18, 1241, 981),
        radius=24,
        outline=(170, 140, 255, 58),
        width=2,
    )

    image = image.resize((630, 500), Image.Resampling.LANCZOS).convert("RGB")
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    image.save(OUTPUT, "PNG", optimize=True)
    print(f"Saved {OUTPUT} at {image.width}x{image.height}")


if __name__ == "__main__":
    render_cover()
