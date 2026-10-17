"""Generates the web link-preview image and app icons in the Soft pop style.

    python3 -I scripts/make-brand-images.py

Writes public/og.png (1200x630, used by link previews), public/apple-touch-icon.png
(180x180) and the native app images in assets/: icon.png (iOS, 1024, opaque),
the Android adaptive icon layers and the light/dark splash images.
Needs Pillow and node_modules installed.

    python3 -I scripts/make-brand-images.py --grain

writes only assets/grain.png, the film grain tiled over event posters (Phase 9.3).
"""

import random
import sys
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


def wordmark(size, background, text, dot, font_ratio):
    """The "wya." wordmark centered on a square. background=None gives a transparent image."""
    S = size * SCALE
    img = Image.new("RGBA", (S, S), background or (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    font = ImageFont.truetype(DISPLAY, int(S * font_ratio))
    w = d.textlength("wya", font=font)
    x = (S - w - d.textlength(".", font=font)) / 2
    d.text((x, S / 2), "wya", font=font, fill=text, anchor="lm")
    d.text((x + w, S / 2), ".", font=font, fill=dot, anchor="lm")
    return img.resize((size, size), Image.LANCZOS)


DARK_BG = "#0B0B0F"  # After dark background


def touch_icon():
    # Web touch icon: dark-mode style to match the app icon
    wordmark(180, DARK_BG, LIME, PINK, 0.345).convert("RGB").save(ROOT / "public/apple-touch-icon.png", optimize=True)


def app_images():
    a = ROOT / "assets"
    # iOS rejects icons with transparency. Dark-mode style: black bg, lime wordmark, hot-pink dot.
    wordmark(1024, DARK_BG, LIME, PINK, 0.345).convert("RGB").save(a / "icon.png", optimize=True)
    # Android adaptive icon: launchers crop to a circle or squircle inside the middle ~66%, so keep the mark small
    Image.new("RGB", (1024, 1024), DARK_BG).save(a / "android-icon-background.png", optimize=True)
    wordmark(1024, None, LIME, PINK, 0.22).save(a / "android-icon-foreground.png", optimize=True)
    wordmark(1024, None, "#FFFFFF", "#FFFFFF", 0.22).save(a / "android-icon-monochrome.png", optimize=True)
    # Splash: light splash uses tangerine dot (matches in-app Logo.tsx in light mode).
    # Dark splash uses hot pink dot (matches in-app Logo.tsx in dark mode).
    wordmark(1024, None, INK, TANGERINE, 0.3).save(a / "splash-icon.png", optimize=True)
    wordmark(1024, None, LIME, PINK, 0.3).save(a / "splash-icon-dark.png", optimize=True)


def grain():
    # Speckles of light and dark at low alpha, so the tile reads as grain on any poster
    # colour. Seeded, so re-running gives the same file.
    rng = random.Random(9)
    size = 160
    img = Image.new("RGBA", (size, size))
    px = img.load()
    for y in range(size):
        for x in range(size):
            v = rng.randint(0, 255)
            a = int(abs(v - 128) / 128 * 70)
            px[x, y] = (v, v, v, a)
    img.save(ROOT / "assets/grain.png", optimize=True)


if __name__ == "__main__":
    if "--grain" in sys.argv:
        grain()
        print("wrote assets/grain.png")
        sys.exit(0)
    (ROOT / "public").mkdir(exist_ok=True)
    og_image()
    touch_icon()
    app_images()
    print("wrote public/og.png, public/apple-touch-icon.png and the app images in assets/")
