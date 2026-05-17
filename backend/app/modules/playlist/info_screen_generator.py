"""Info Screen Generator — Pillow ile 1920x1080 görsel oluşturur.

Kullanım:
    from app.modules.playlist.info_screen_generator import generate_info_screen_image
    path = generate_info_screen_image(db)
"""
from __future__ import annotations

import io
import os
import textwrap
import urllib.request
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

OUTPUT_PATH = "/tmp/info_screen.png"
FONT_DIR = Path("/usr/share/fonts")

# Fallback: DejaVu Sans (hemen hemen her Linux'ta mevcut)
_FONT_FALLBACKS = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
]


def _find_font(size: int):
    """PIL ImageFont yükler — kurulu TrueType font bulamazsa varsayılan kullanır."""
    try:
        from PIL import ImageFont
        for path in _FONT_FALLBACKS:
            if os.path.exists(path):
                return ImageFont.truetype(path, size)
        return ImageFont.load_default()
    except Exception:
        try:
            from PIL import ImageFont
            return ImageFont.load_default()
        except Exception:
            return None


def _download_image(url: str, timeout: int = 5) -> bytes | None:
    """URL'den görsel indir. Hata durumunda None döner."""
    if not url:
        return None
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "VODManager/1.0"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.read()
    except Exception:
        return None


def _load_bg_image(bg_url: str | None, width: int, height: int):
    """Arka plan görselini yükle veya düz renkli bir arka plan döndür."""
    from PIL import Image

    if bg_url:
        # Sunucu içi URL'yi mutlak yola çevir
        if bg_url.startswith("/uploads/"):
            local_path = f"/var/www/vod-manager/shared{bg_url}"
            if os.path.exists(local_path):
                try:
                    img = Image.open(local_path).convert("RGBA")
                    return img.resize((width, height), Image.LANCZOS)
                except Exception:
                    pass
        # HTTP URL: indir
        data = _download_image(bg_url)
        if data:
            try:
                img = Image.open(io.BytesIO(data)).convert("RGBA")
                return img.resize((width, height), Image.LANCZOS)
            except Exception:
                pass

    # Varsayılan: sinema teması koyu arka plan (derin gece mavisi)
    bg = Image.new("RGBA", (width, height), (10, 10, 30, 255))
    return bg


def _hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    hex_color = hex_color.lstrip("#")
    try:
        r = int(hex_color[0:2], 16)
        g = int(hex_color[2:4], 16)
        b = int(hex_color[4:6], 16)
        return (r, g, b)
    except Exception:
        return (212, 168, 67)  # Altın rengi


def generate_info_screen_image(db: Session, output_path: str = OUTPUT_PATH) -> str:
    """Veritabanından now-playing bilgilerini alır ve görsel oluşturur.

    Returns: output_path (başarılı) veya exception.
    """
    from PIL import Image, ImageDraw, ImageFilter

    from app.modules.playlist.broadcast import get_all_now_playing
    from app.modules.playlist.models import InfoScreenTemplate

    WIDTH, HEIGHT = 1920, 1080

    # --- Şablon ---
    tmpl: InfoScreenTemplate | None = (
        db.query(InfoScreenTemplate)
        .filter(InfoScreenTemplate.is_default == True)
        .first()
    )
    if tmpl is None:
        tmpl = db.query(InfoScreenTemplate).order_by(InfoScreenTemplate.id.asc()).first()

    primary_color_hex = (tmpl.primary_color if tmpl else "#D4A843")
    primary_rgb = _hex_to_rgb(primary_color_hex)
    overlay_opacity = int(tmpl.bg_overlay_opacity if tmpl else 70) * 255 // 100
    title_text = (tmpl.title_text if tmpl else "ŞU ANDA YAYINDA OLANLAR")
    subtitle_text = (tmpl.subtitle_text if tmpl else "SİNEMA KANALLARI")
    bg_url: str | None = (tmpl.bg_image_url if tmpl else None)

    # --- Arka plan ---
    bg = _load_bg_image(bg_url, WIDTH, HEIGHT)

    # Karanlık overlay
    overlay = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, overlay_opacity))
    bg = Image.alpha_composite(bg, overlay)

    draw = ImageDraw.Draw(bg)

    # --- Fontlar ---
    font_title = _find_font(72)
    font_subtitle = _find_font(36)
    font_header = _find_font(30)
    font_channel = _find_font(34)
    font_movie = _find_font(30)
    font_number = _find_font(38)

    # --- Sol/sağ altın çizgi (dekoratif) ---
    line_y = 160
    draw.rectangle([(80, line_y), (WIDTH - 80, line_y + 4)], fill=(*primary_rgb, 200))

    # --- Başlık ---
    title_y = 60
    if font_title:
        # Metin ortala (yaklaşık)
        try:
            bbox = draw.textbbox((0, 0), title_text, font=font_title)
            text_w = bbox[2] - bbox[0]
        except Exception:
            text_w = len(title_text) * 40
        draw.text(
            ((WIDTH - text_w) // 2, title_y),
            title_text,
            fill=(*primary_rgb, 255),
            font=font_title,
        )

    # --- Alt başlık ---
    if subtitle_text and font_subtitle:
        try:
            bbox = draw.textbbox((0, 0), subtitle_text, font=font_subtitle)
            sub_w = bbox[2] - bbox[0]
        except Exception:
            sub_w = len(subtitle_text) * 20
        draw.text(
            ((WIDTH - sub_w) // 2, title_y + 82),
            subtitle_text,
            fill=(200, 200, 200, 200),
            font=font_subtitle,
        )

    # --- Sütun başlıkları ---
    col_y = 185
    headers = ["#", "KANAL ADI", "ŞU AN YAYINDA"]
    col_x = [80, 160, 680]
    for i, (hdr, x) in enumerate(zip(headers, col_x)):
        if font_header:
            draw.text((x, col_y), hdr, fill=(180, 180, 180, 220), font=font_header)

    draw.rectangle([(80, col_y + 40), (WIDTH - 80, col_y + 43)], fill=(*primary_rgb, 120))

    # --- Kanal listesi ---
    channels: list[dict[str, Any]] = get_all_now_playing(db)

    row_height = 62
    max_rows = min(len(channels), 13)  # 1080px yüksekliğe sığacak kadar
    start_y = col_y + 55

    for idx, ch in enumerate(channels[:max_rows]):
        row_y = start_y + idx * row_height
        is_even = idx % 2 == 0

        # Satır arka planı
        row_bg_alpha = 40 if is_even else 20
        draw.rectangle(
            [(80, row_y - 8), (WIDTH - 80, row_y + row_height - 12)],
            fill=(255, 255, 255, row_bg_alpha),
        )

        # Kanal numarası
        num_str = str(ch["channel_number"])
        if font_number:
            draw.text((col_x[0] + 10, row_y), num_str, fill=(*primary_rgb, 255), font=font_number)

        # Kanal adı (max 20 karakter)
        ch_name = (ch.get("playlist_name") or "")[:28]
        if font_channel:
            draw.text((col_x[1], row_y), ch_name, fill=(240, 240, 240, 255), font=font_channel)

        # Şu an yayında
        now_title = ch.get("current_title")
        if now_title and ch.get("status") == "playing":
            # 45 karakter ile sınırla
            truncated = now_title[:45] + ("..." if len(now_title) > 45 else "")
            if font_movie:
                draw.text((col_x[2], row_y), truncated, fill=(220, 220, 160, 255), font=font_movie)
        elif ch.get("status") == "playing":
            if font_movie:
                draw.text((col_x[2], row_y), "Yayında", fill=(100, 220, 100, 200), font=font_movie)
        else:
            if font_movie:
                draw.text((col_x[2], row_y), "—", fill=(120, 120, 120, 180), font=font_movie)

    # --- Alt çizgi ---
    bottom_y = HEIGHT - 60
    draw.rectangle([(80, bottom_y), (WIDTH - 80, bottom_y + 3)], fill=(*primary_rgb, 150))

    # --- Alt bilgi ---
    from datetime import datetime, timezone
    now_str = datetime.now(timezone.utc).strftime("%d.%m.%Y  %H:%M UTC")
    if font_subtitle:
        draw.text((80, bottom_y + 12), "VOD Manager", fill=(*primary_rgb, 200), font=font_subtitle)
        try:
            bbox = draw.textbbox((0, 0), now_str, font=font_subtitle)
            time_w = bbox[2] - bbox[0]
        except Exception:
            time_w = len(now_str) * 18
        draw.text((WIDTH - 80 - time_w, bottom_y + 12), now_str, fill=(180, 180, 180, 200), font=font_subtitle)

    # Kaydet
    os.makedirs(os.path.dirname(output_path) if os.path.dirname(output_path) else "/tmp", exist_ok=True)
    bg_rgb = bg.convert("RGB")
    bg_rgb.save(output_path, "PNG", optimize=False)
    return output_path
