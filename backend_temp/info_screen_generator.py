"""Info Screen Generator - Pillow ile 1920x1080 gorsel olusturur."""
from __future__ import annotations

import io
import os
import urllib.request
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

OUTPUT_PATH = "/tmp/info_screen.png"
FONT_DIR = Path("/usr/share/fonts")
DEFAULT_BG_PATH = "/var/www/vod-manager/shared/uploads/info-screen-bg/cinema_default.png"

_FONT_BOLD_FALLBACKS = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
]
_FONT_REG_FALLBACKS = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
]


def _find_font(paths: list, size: int):
    try:
        from PIL import ImageFont
        for path in paths:
            if os.path.exists(path):
                return ImageFont.truetype(path, size)
        return ImageFont.load_default()
    except Exception:
        return None


def _download_image(url: str, timeout: int = 5) -> bytes | None:
    if not url:
        return None
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "VODManager/1.0"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.read()
    except Exception:
        return None


def _load_bg_image(bg_url: str | None, width: int, height: int):
    """Arkaplan yukle: once bg_url, fallback olarak cinema_default.png."""
    from PIL import Image

    def _try_file(path: str):
        try:
            img = Image.open(path).convert("RGBA")
            return img.resize((width, height), Image.LANCZOS)
        except Exception:
            return None

    # Oncelik 1: belirtilen bg_url
    if bg_url:
        if bg_url.startswith("/uploads/"):
            local_path = f"/var/www/vod-manager/shared{bg_url}"
            result = _try_file(local_path)
            if result:
                return result
        elif bg_url.startswith("http"):
            data = _download_image(bg_url)
            if data:
                try:
                    img = Image.open(io.BytesIO(data)).convert("RGBA")
                    return img.resize((width, height), Image.LANCZOS)
                except Exception:
                    pass

    # Oncelik 2: cinema_default.png
    result = _try_file(DEFAULT_BG_PATH)
    if result:
        return result

    # Fallback: koyu arka plan
    bg = Image.new("RGBA", (width, height), (10, 10, 30, 255))
    return bg


def _hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    hex_color = hex_color.lstrip("#")
    try:
        return (int(hex_color[0:2], 16), int(hex_color[2:4], 16), int(hex_color[4:6], 16))
    except Exception:
        return (212, 168, 67)


def generate_info_screen_image(db: Session, output_path: str = OUTPUT_PATH) -> str:
    from PIL import Image, ImageDraw

    from app.modules.playlist.broadcast import get_all_now_playing
    from app.modules.playlist.models import InfoScreenTemplate

    WIDTH, HEIGHT = 1920, 1080

    tmpl: InfoScreenTemplate | None = (
        db.query(InfoScreenTemplate)
        .filter(InfoScreenTemplate.is_default == True)  # noqa: E712
        .first()
    )
    if tmpl is None:
        tmpl = db.query(InfoScreenTemplate).order_by(InfoScreenTemplate.id.asc()).first()

    primary_color_hex = (tmpl.primary_color if tmpl else "#D4A843")
    primary_rgb = _hex_to_rgb(primary_color_hex)
    overlay_opacity = int(tmpl.bg_overlay_opacity if tmpl else 30) * 255 // 100
    title_text = (tmpl.title_text if tmpl else "SU ANDA YAYINDA OLANLAR")
    subtitle_text = (tmpl.subtitle_text if tmpl else "SINEMA KANALLARI")
    bg_url: str | None = (tmpl.bg_image_url if tmpl else None)

    # Arka plan - cinema_default.png veya belirtilen url
    bg = _load_bg_image(bg_url, WIDTH, HEIGHT)

    # Sol taraf icin yari-saydam siyah panel (okunabilirlik icin)
    panel = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    panel_draw = ImageDraw.Draw(panel)
    panel_w = int(WIDTH * 0.58)
    # Sol panel - koyu siyah
    panel_draw.rectangle([(0, 0), (panel_w, HEIGHT)], fill=(0, 0, 0, 195))
    # Yumusak gecis (gradyan simulasyonu)
    for i in range(100):
        alpha = int(195 * (1 - i / 100))
        panel_draw.rectangle([(panel_w + i, 0), (panel_w + i + 1, HEIGHT)], fill=(0, 0, 0, alpha))
    bg = Image.alpha_composite(bg, panel)

    # Hafif genel overlay
    if overlay_opacity > 0:
        overlay = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, overlay_opacity))
        bg = Image.alpha_composite(bg, overlay)

    draw = ImageDraw.Draw(bg)

    # Fontlar
    font_title    = _find_font(_FONT_BOLD_FALLBACKS, 68)
    font_subtitle = _find_font(_FONT_BOLD_FALLBACKS, 28)
    font_header   = _find_font(_FONT_BOLD_FALLBACKS, 22)
    font_channel  = _find_font(_FONT_BOLD_FALLBACKS, 30)
    font_movie    = _find_font(_FONT_REG_FALLBACKS, 26)
    font_number   = _find_font(_FONT_BOLD_FALLBACKS, 32)
    font_time     = _find_font(_FONT_REG_FALLBACKS, 22)

    LEFT_PAD = 60
    CONTENT_W = int(WIDTH * 0.55)

    # Altin dekoratif sol cerit
    draw.rectangle([(LEFT_PAD, 40), (LEFT_PAD + 5, HEIGHT - 40)], fill=(*primary_rgb, 180))

    # Alt baslik (kucuk, altin)
    title_x = LEFT_PAD + 24
    title_y = 55
    if subtitle_text and font_subtitle:
        draw.text((title_x, title_y), subtitle_text.upper(), fill=(*primary_rgb, 230), font=font_subtitle)

    # Ana baslik (buyuk, beyaz)
    title_y2 = title_y + 44
    if font_title:
        draw.text((title_x, title_y2), title_text.upper(), fill=(255, 255, 255, 255), font=font_title)

    # Altin alt cizgi
    line_y = title_y2 + 82
    draw.rectangle([(LEFT_PAD, line_y), (CONTENT_W + LEFT_PAD, line_y + 4)], fill=(*primary_rgb, 220))

    # Sutun basliklari
    col_y = line_y + 18
    col_x_num  = LEFT_PAD + 24
    col_x_name = LEFT_PAD + 100
    col_x_film = LEFT_PAD + 520

    if font_header:
        draw.text((col_x_num, col_y), "#", fill=(*primary_rgb, 200), font=font_header)
        draw.text((col_x_name, col_y), "KANAL", fill=(*primary_rgb, 200), font=font_header)
        draw.text((col_x_film, col_y), "SU AN YAYINDA", fill=(*primary_rgb, 200), font=font_header)

    draw.rectangle([(LEFT_PAD, col_y + 32), (CONTENT_W + LEFT_PAD, col_y + 34)], fill=(*primary_rgb, 100))

    # Kanal listesi
    channels: list[dict[str, Any]] = get_all_now_playing(db)
    row_height = 58
    max_rows = min(len(channels), 12)
    start_y = col_y + 46

    for idx, ch in enumerate(channels[:max_rows]):
        row_y = start_y + idx * row_height
        is_even = idx % 2 == 0

        # Satir arkaplan
        row_alpha = 35 if is_even else 15
        draw.rectangle(
            [(LEFT_PAD + 8, row_y - 6), (CONTENT_W + LEFT_PAD, row_y + row_height - 16)],
            fill=(255, 255, 255, row_alpha),
        )

        # Kanal numarasi (altin)
        num_str = str(ch["channel_number"]).zfill(2)
        if font_number:
            draw.text((col_x_num, row_y), num_str, fill=(*primary_rgb, 255), font=font_number)

        # Kanal adi (beyaz)
        ch_name = (ch.get("playlist_name") or "")[:24]
        if font_channel:
            draw.text((col_x_name, row_y), ch_name, fill=(240, 240, 240, 255), font=font_channel)

        # Film adi (sarimsı)
        now_title = ch.get("current_title")
        if now_title and ch.get("status") == "playing":
            truncated = now_title[:38] + ("..." if len(now_title) > 38 else "")
            if font_movie:
                draw.text((col_x_film, row_y + 4), truncated, fill=(220, 200, 120, 255), font=font_movie)
        elif ch.get("status") == "playing":
            if font_movie:
                draw.text((col_x_film, row_y + 4), "Yayinda", fill=(100, 220, 100, 200), font=font_movie)
        else:
            if font_movie:
                draw.text((col_x_film, row_y + 4), "Durduruldu", fill=(130, 130, 130, 180), font=font_movie)

    # Alt bilgi
    from datetime import datetime, timezone
    now_str = datetime.now(timezone.utc).strftime("%d.%m.%Y  %H:%M UTC")
    bottom_y = HEIGHT - 56
    draw.rectangle([(LEFT_PAD, bottom_y - 8), (CONTENT_W + LEFT_PAD, bottom_y - 5)], fill=(*primary_rgb, 130))

    if font_time:
        draw.text((title_x, bottom_y), "VOD Manager", fill=(*primary_rgb, 200), font=font_time)
        draw.text((title_x + 300, bottom_y), now_str, fill=(180, 180, 180, 200), font=font_time)

    os.makedirs(os.path.dirname(output_path) if os.path.dirname(output_path) else "/tmp", exist_ok=True)
    bg_rgb = bg.convert("RGB")
    bg_rgb.save(output_path, "PNG", optimize=False)
    return output_path
