"""Info Screen Generator — Pillow ile 1920x1080 görsel oluşturur.

Düzen: Sol panel (60%) koyu arka plan + kanal listesi
       Sağ panel (40%) sinema arka plan görseli
       7 kanal, cover tam boyut, yanında kanal adı + film adı
"""
from __future__ import annotations

import io
import os
import urllib.request
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

OUTPUT_PATH = "/tmp/info_screen.png"

_FONT_FALLBACKS = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
]

POSTER_W = 120   # Cover genişliği
POSTER_H = 180   # Cover yüksekliği (3:2 aspect ratio)
MAX_CHANNELS = 7 # Sadece 7 kanal


def _find_font(size: int):
    from PIL import ImageFont
    for path in _FONT_FALLBACKS:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


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
    from PIL import Image
    if bg_url:
        if bg_url.startswith("/uploads/"):
            local_path = f"/var/www/vod-manager/shared{bg_url}"
            if os.path.exists(local_path):
                try:
                    img = Image.open(local_path).convert("RGBA")
                    return img.resize((width, height), Image.LANCZOS)
                except Exception:
                    pass
        data = _download_image(bg_url)
        if data:
            try:
                img = Image.open(io.BytesIO(data)).convert("RGBA")
                return img.resize((width, height), Image.LANCZOS)
            except Exception:
                pass
    return Image.new("RGBA", (width, height), (10, 10, 30, 255))


def _hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    hex_color = hex_color.lstrip("#")
    try:
        return (int(hex_color[0:2], 16), int(hex_color[2:4], 16), int(hex_color[4:6], 16))
    except Exception:
        return (212, 168, 67)


def _load_poster(url: str | None):
    from PIL import Image
    if not url:
        return None
    data = _download_image(url, timeout=4)
    if not data:
        return None
    try:
        img = Image.open(io.BytesIO(data)).convert("RGBA")
        return img.resize((POSTER_W, POSTER_H), Image.LANCZOS)
    except Exception:
        return None


def generate_info_screen_image(db: Session, output_path: str = OUTPUT_PATH) -> str:
    from PIL import Image, ImageDraw
    from app.modules.playlist.broadcast import get_all_now_playing
    from app.modules.playlist.models import InfoScreenTemplate

    W, H = 1920, 1080
    LEFT_W = 1200  # Sol panel
    MARGIN = 60    # Kenar boşluğu

    # Şablon
    tmpl = db.query(InfoScreenTemplate).filter(InfoScreenTemplate.is_default == True).first()
    if tmpl is None:
        tmpl = db.query(InfoScreenTemplate).order_by(InfoScreenTemplate.id.asc()).first()

    primary_rgb = _hex_to_rgb(tmpl.primary_color if tmpl else "#D4A843")
    title_text = tmpl.title_text if tmpl else "ŞU ANDA YAYINDA OLANLAR"
    subtitle_text = tmpl.subtitle_text if tmpl else "SİNEMA KANALLARI"
    bg_url = tmpl.bg_image_url if tmpl else None

    # Arka plan
    bg = _load_bg_image(bg_url, W, H)

    # Sol panel: koyu yarı saydam
    left_panel = Image.new("RGBA", (LEFT_W, H), (5, 5, 15, 240))
    bg.paste(left_panel, (0, 0), left_panel)

    draw = ImageDraw.Draw(bg)

    # Fontlar
    font_title = _find_font(64)
    font_subtitle = _find_font(32)
    font_channel = _find_font(30)
    font_movie = _find_font(26)
    font_number = _find_font(32)

    # Başlık
    title_y = 50
    if font_title:
        try:
            bbox = draw.textbbox((0, 0), title_text, font=font_title)
            tw = bbox[2] - bbox[0]
        except Exception:
            tw = len(title_text) * 36
        draw.text(((LEFT_W - tw) // 2, title_y), title_text, fill=(*primary_rgb, 255), font=font_title)

    # Alt başlık
    if subtitle_text and font_subtitle:
        try:
            bbox = draw.textbbox((0, 0), subtitle_text, font=font_subtitle)
            sw = bbox[2] - bbox[0]
        except Exception:
            sw = len(subtitle_text) * 18
        draw.text(((LEFT_W - sw) // 2, title_y + 75), subtitle_text, fill=(180, 180, 180, 200), font=font_subtitle)

    # Altın çizgi
    draw.rectangle([(MARGIN, 155), (LEFT_W - MARGIN, 158)], fill=(*primary_rgb, 200))

    # Kanal listesi
    channels = get_all_now_playing(db)
    channels = channels[:MAX_CHANNELS]  # Sadece 7 kanal

    # Her kanal için satır yüksekliği = cover yüksekliği + boşluk
    row_h = POSTER_H + 20
    start_y = 175

    for idx, ch in enumerate(channels):
        row_y = start_y + idx * row_h

        # Satır arka planı (koyu)
        alpha = 40 if idx % 2 == 0 else 20
        draw.rectangle([(MARGIN, row_y), (LEFT_W - MARGIN, row_y + POSTER_H)], fill=(0, 0, 0, alpha))

        # Kanal numarası (solda, dikey ortada)
        num_x = MARGIN + 15
        num_y = row_y + POSTER_H // 2 - 16
        if font_number:
            draw.text((num_x, num_y), str(ch["channel_number"]), fill=(*primary_rgb, 255), font=font_number)

        # Cover (poster) — tam boyut
        poster_x = MARGIN + 70
        poster = _load_poster(ch.get("current_poster"))
        if poster:
            bg.paste(poster, (poster_x, row_y), poster)
        else:
            ph = Image.new("RGBA", (POSTER_W, POSTER_H), (50, 50, 60, 255))
            bg.paste(ph, (poster_x, row_y), ph)

        # Metin alanı (cover'ın sağında)
        text_x = poster_x + POSTER_W + 25
        text_y = row_y + POSTER_H // 2  # Dikey orta

        # Kanal adı (üstte)
        ch_name = (ch.get("playlist_name") or "")[:30]
        if font_channel:
            draw.text((text_x, text_y - 35), ch_name, fill=(255, 255, 255, 255), font=font_channel)

        # Film adı (altta, kanal adının altında)
        now_title = ch.get("current_title")
        if now_title and ch.get("status") == "playing":
            t = now_title[:42] + ("..." if len(now_title) > 42 else "")
            if font_movie:
                draw.text((text_x, text_y + 5), t, fill=(220, 200, 100, 255), font=font_movie)
        elif ch.get("status") == "playing":
            if font_movie:
                draw.text((text_x, text_y + 5), "Yayında", fill=(100, 220, 100, 200), font=font_movie)
        else:
            if font_movie:
                draw.text((text_x, text_y + 5), "—", fill=(120, 120, 120, 180), font=font_movie)

    # Alt çizgi
    by = H - 55
    draw.rectangle([(MARGIN, by), (LEFT_W - MARGIN, by + 2)], fill=(*primary_rgb, 150))

    # Alt bilgi
    from datetime import datetime, timezone
    now_str = datetime.now(timezone.utc).strftime("%d.%m.%Y %H:%M UTC")
    if font_subtitle:
        draw.text((MARGIN, by + 12), "VOD Manager", fill=(*primary_rgb, 180), font=font_subtitle)
        try:
            bbox = draw.textbbox((0, 0), now_str, font=font_subtitle)
            tw = bbox[2] - bbox[0]
        except Exception:
            tw = len(now_str) * 18
        draw.text((LEFT_W - MARGIN - tw, by + 12), now_str, fill=(160, 160, 160, 180), font=font_subtitle)

    # Kaydet
    os.makedirs(os.path.dirname(output_path) or "/tmp", exist_ok=True)
    bg.convert("RGB").save(output_path, "PNG", optimize=False)
    return output_path
