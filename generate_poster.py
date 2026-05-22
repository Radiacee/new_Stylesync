from PIL import Image, ImageDraw, ImageFont
from psd_tools import PSDImage
import os

WIDTH, HEIGHT = 3600, 5400
DPI = 300
OUTPUT_JPG = 'StyleSync_Poster_12x18.jpg'
OUTPUT_PSD = 'StyleSync_Poster_12x18.psd'
FONT_PATHS = [
    'C:\\Windows\\Fonts\\arial.ttf',
    'C:\\Windows\\Fonts\\segoeui.ttf',
    'C:\\Windows\\Fonts\\tahoma.ttf',
]


def load_font(size):
    for path in FONT_PATHS:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return ImageFont.load_default()


def gradient_background(width, height):
    bg = Image.new('RGB', (width, height), '#06122B')
    draw = ImageDraw.Draw(bg)
    for y in range(height):
        blend = y / height
        r = int(8 + (30 - 8) * blend)
        g = int(28 + (76 - 28) * blend)
        b = int(58 + (130 - 58) * blend)
        draw.line([(0, y), (width, y)], fill=(r, g, b))
    return bg


def make_text_layer(text, font, fill, spacing=10, align='left'):
    dummy = Image.new('RGBA', (10, 10), (0, 0, 0, 0))
    draw = ImageDraw.Draw(dummy)
    bbox = draw.multiline_textbbox((0, 0), text, font=font, spacing=spacing, align=align)
    img = Image.new('RGBA', (bbox[2] - bbox[0], bbox[3] - bbox[1]), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.multiline_text((-bbox[0], -bbox[1]), text, font=font, fill=fill, spacing=spacing, align=align)
    return img


def create_poster():
    # Base design
    bg = gradient_background(WIDTH, HEIGHT)
    overlay = Image.new('RGBA', (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    # Soft glow circle
    circle_size = int(WIDTH * 0.8)
    circle_xy = ((WIDTH - circle_size) // 2, int(HEIGHT * 0.08))
    draw.ellipse([circle_xy, (circle_xy[0] + circle_size, circle_xy[1] + circle_size)], fill=(255, 255, 255, 32))

    # Accent banners
    draw.rectangle([(200, 520), (WIDTH - 200, 640)], fill=(13, 104, 204, 180))
    draw.rectangle([(200, 1220), (WIDTH - 200, 1320)], fill=(35, 155, 160, 180))

    title_font = load_font(220)
    subtitle_font = load_font(80)
    feature_font = load_font(62)
    badge_font = load_font(48)

    title_text = 'StyleSync'
    subtitle_text = 'Paraphrase in your own writing voice'
    features_text = '• Preserve your style\n• Generate smarter rewrites\n• Get personalized guidance'
    cta_text = 'Create your profile today and rewrite with confidence'

    title_layer = make_text_layer(title_text, title_font, '#F8FAFF')
    subtitle_layer = make_text_layer(subtitle_text, subtitle_font, '#DDE7FF')
    features_layer = make_text_layer(features_text, feature_font, '#E8F1FF')
    cta_layer = make_text_layer(cta_text, subtitle_font, '#F8FAFF')
    badge_layer = make_text_layer('Onboarding • Paraphrase • Writing Guide', badge_font, '#FFFFFF')

    # Compose a flattened preview image for JPG
    preview = bg.copy()
    preview.paste(overlay, (0, 0), overlay)
    preview.paste(title_layer, (220, 580), title_layer)
    preview.paste(subtitle_layer, (220, 840), subtitle_layer)
    preview.paste(features_layer, (220, 1160), features_layer)
    preview.paste(cta_layer, (220, 2100), cta_layer)
    preview.paste(badge_layer, (220, 4520), badge_layer)

    # Add design accent blocks
    draw_preview = ImageDraw.Draw(preview)
    draw_preview.rectangle([(200, 2350), (WIDTH - 200, 2450)], fill=(255, 255, 255, 32))
    draw_preview.rectangle([(200, 2750), (WIDTH - 200, 2850)], fill=(255, 255, 255, 32))
    draw_preview.rectangle([(200, 3150), (WIDTH - 200, 3250)], fill=(255, 255, 255, 32))

    preview.save(OUTPUT_JPG, 'JPEG', quality=95, dpi=(DPI, DPI))
    print('Saved JPG:', OUTPUT_JPG)

    # Create layered PSD
    psd = PSDImage.new('RGB', size=(WIDTH, HEIGHT))
    psd.create_pixel_layer(bg, name='Background')
    psd.create_pixel_layer(overlay, name='Glow & Accent')
    psd.create_pixel_layer(title_layer, name='Title')
    psd.create_pixel_layer(subtitle_layer, name='Subtitle')
    psd.create_pixel_layer(features_layer, name='Features')
    psd.create_pixel_layer(cta_layer, name='Call to Action')
    psd.create_pixel_layer(badge_layer, name='Footer Badge')
    psd.save(OUTPUT_PSD)
    print('Saved PSD:', OUTPUT_PSD)


if __name__ == '__main__':
    create_poster()
