"""Generates the web link-preview image and app icons in the Soft pop style.

    python3 -I scripts/make-brand-images.py

Writes public/og.png (1200x630, used by link previews) and
public/apple-touch-icon.png (180x180). Needs Pillow and node_modules installed.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
FONTS = ROOT / "node_modules/@expo-google-fonts"
DISPLAY = str(FONTS / "bricolage-grotesque/800ExtraBold/BricolageGrotesque_800ExtraBold.ttf")
BODY = str(FONTS / "dm-sans/500Medium/DMSans_500Medium.ttf")

CREAM, INK = "#FFF6EC", "#1C1530"
LIME, PINK, VIOLET, TANGERINE, SUNSHINE = "#D4FF3F", "#FF3CAC", "#8B5CFF", "#FF6A3D", "#FFE15C"
SCALE = 2  # draw at 2x, then downsample for smooth edges


def tile(size, fill, letter, letter_color, angle):
    """A rounded event-cover tile with an ink outline and hard shadow, rotated."""
    w, h = size
    pad = 40 * SCALE
    img = Image.new("RGBA", (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    r, o, s = 36 * SCALE, 5 * SCALE, 10 * SCALE
    d.rounded_rectangle((pad + s, pad + s, pad + w + s, pad + h + s), r, fill=INK)  # hard shadow
    d.rounded_rectangle((pad, pad, pad + w, pad + h), r, fill=fill, outline=INK, width=o)
    font = ImageFont.truetype(DISPLAY, int(h * 0.62))
    d.text((pad + w / 2, pad + h / 2), letter, font=font, fill=letter_color, anchor="mm")
    return img.rotate(angle, resample=Image.BICUBIC, expand=True)


def sticker(text, fill, angle, size=30):
    font = ImageFont.truetype(DISPLAY, size * SCALE)
    box = font.getbbox(text)
    w, h = box[2] - box[0] + 44 * SCALE, box[3] - box[1] + 26 * SCALE
    pad = 10 * SCALE
    img = Image.new("RGBA", (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((pad, pad, pad + w, pad + h), h // 2, fill=fill, outline=INK, width=4 * SCALE)
    d.text((pad + w / 2, pad + h / 2), text, font=font, fill=INK, anchor="mm")
    return img.rotate(angle, resample=Image.BICUBIC, expand=True)


def og_image():
    W, H = 1200 * SCALE, 630 * SCALE
    img = Image.new("RGB", (W, H), CREAM)
    d = ImageDraw.Draw(img)

    # Left: wordmark, headline, subline
    big = ImageFont.truetype(DISPLAY, 150 * SCALE)
    d.text((80 * SCALE, 70 * SCALE), "wya", font=big, fill=INK)
    dot_x = 80 * SCALE + d.textlength("wya", font=big)
    d.text((dot_x, 70 * SCALE), ".", font=big, fill=TANGERINE)
    head = ImageFont.truetype(DISPLAY, 78 * SCALE)
    d.text((80 * SCALE, 290 * SCALE), "You're\ninvited.", font=head, fill=INK, spacing=-6 * SCALE)
    sub = ImageFont.truetype(BODY, 30 * SCALE)
    d.text((80 * SCALE, 500 * SCALE), "RSVP, see who's going, join the chat.", font=sub, fill="#5E5673")

    # Right: a collage of tilted event tiles and stickers
    for t, (x, y) in [
        (tile((250 * SCALE, 290 * SCALE), PINK, "R", INK, 8), (640, 40)),
        (tile((250 * SCALE, 290 * SCALE), LIME, "B", INK, -6), (840, 120)),
        (tile((230 * SCALE, 260 * SCALE), VIOLET, "G", "#FFFFFF", 5), (700, 300)),
    ]:
        img.paste(t, (x * SCALE, y * SCALE), t)
    for s, (x, y) in [(sticker("8 going", SUNSHINE, 9), (930, 430)), (sticker("Sat 9 PM", TANGERINE, -7), (620, 470))]:
        img.paste(s, (x * SCALE, y * SCALE), s)

    img.resize((1200, 630), Image.LANCZOS).save(ROOT / "public/og.png", optimize=True)


def touch_icon():
    S = 180 * SCALE
    img = Image.new("RGB", (S, S), VIOLET)
    d = ImageDraw.Draw(img)
    font = ImageFont.truetype(DISPLAY, 62 * SCALE)
    w = d.textlength("wya", font=font)
    x = (S - w - d.textlength(".", font=font)) / 2
    d.text((x, S / 2), "wya", font=font, fill="#FFFFFF", anchor="lm")
    d.text((x + w, S / 2), ".", font=font, fill=SUNSHINE, anchor="lm")
    img.resize((180, 180), Image.LANCZOS).save(ROOT / "public/apple-touch-icon.png", optimize=True)


if __name__ == "__main__":
    (ROOT / "public").mkdir(exist_ok=True)
    og_image()
    touch_icon()
    print("wrote public/og.png and public/apple-touch-icon.png")
