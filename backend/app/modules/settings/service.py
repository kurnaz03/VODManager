from __future__ import annotations

import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

import httpx
from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.security import decrypt_secret, encrypt_secret
from app.modules.settings.models import YoutubeCookieCredential, YoutubeCookieStatus
from app.modules.settings.schemas import (
    ThemeSettingsResponse,
    ThemeSettingsUpdate,
    TmdbSettingsResponse,
    TmdbSettingsUpdate,
    TmdbTestResponse,
    YoutubeLoginRequest,
    YoutubeSettingsResponse,
)
from app.modules.users.models import SystemSetting

DEFAULT_THEME_SETTINGS = {
    "panel_name": "VOD Manager",
    "logo_url": None,
    "primary_color": "#3B82F6",
    "sidebar_color": "#0F172A",
    "accent_color": "#14B8A6",
}

DEFAULT_TMDB_LANGUAGE = "tr-TR"
YOUTUBE_REFRESH_INTERVAL_MINUTES = 4
YOUTUBE_LOGIN_TIMEOUT_MS = 180000


def get_setting(db: Session, key: str, default: str | None = None) -> str | None:
    row = db.query(SystemSetting).filter(SystemSetting.key == key).first()
    if row is None:
        return default
    return row.value


def set_setting(db: Session, key: str, value: str | None) -> None:
    row = db.query(SystemSetting).filter(SystemSetting.key == key).first()
    if row:
        row.value = value
    else:
        row = SystemSetting(key=key, value=value)
        db.add(row)
    db.commit()


def is_initial_admin_created(db: Session) -> bool:
    val = get_setting(db, "setup.initial_admin_created", "false")
    return val == "true"


def mark_initial_admin_created(db: Session) -> None:
    set_setting(db, "setup.initial_admin_created", "true")


def _upsert_setting(db: Session, key: str, value: str | None) -> None:
    row = db.query(SystemSetting).filter(SystemSetting.key == key).first()
    if row:
        row.value = value
    else:
        db.add(SystemSetting(key=key, value=value))


def _settings_map(db: Session, keys: list[str]) -> dict[str, str | None]:
    rows = db.query(SystemSetting).filter(SystemSetting.key.in_(keys)).all()
    return {row.key: row.value for row in rows}


def get_theme_settings(db: Session) -> ThemeSettingsResponse:
    values = _settings_map(
        db,
        [
            "theme.panel_name",
            "theme.logo_url",
            "theme.primary_color",
            "theme.sidebar_color",
            "theme.accent_color",
        ],
    )
    return ThemeSettingsResponse(
        panel_name=values.get("theme.panel_name") or DEFAULT_THEME_SETTINGS["panel_name"],
        logo_url=values.get("theme.logo_url") or DEFAULT_THEME_SETTINGS["logo_url"],
        primary_color=values.get("theme.primary_color") or DEFAULT_THEME_SETTINGS["primary_color"],
        sidebar_color=values.get("theme.sidebar_color") or DEFAULT_THEME_SETTINGS["sidebar_color"],
        accent_color=values.get("theme.accent_color") or DEFAULT_THEME_SETTINGS["accent_color"],
    )


def update_theme_settings(db: Session, payload: ThemeSettingsUpdate) -> ThemeSettingsResponse:
    current = get_theme_settings(db)
    _upsert_setting(db, "theme.panel_name", payload.panel_name.strip() or current.panel_name)
    _upsert_setting(db, "theme.primary_color", payload.primary_color)
    _upsert_setting(db, "theme.sidebar_color", payload.sidebar_color)
    _upsert_setting(db, "theme.accent_color", payload.accent_color)
    db.commit()
    return get_theme_settings(db)


def _extract_filename_from_logo_url(logo_url: str | None) -> str | None:
    if not logo_url:
        return None
    return logo_url.rsplit("/", 1)[-1]


def resolve_logo_file(filename: str) -> Path:
    safe_name = Path(filename).name
    file_path = settings.logos_path / safe_name
    if not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Logo bulunamadi")
    return file_path


def upload_theme_logo(db: Session, file: UploadFile) -> ThemeSettingsResponse:
    extension = Path(file.filename or "").suffix.lower()
    if extension not in {".png", ".svg"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Sadece PNG veya SVG yuklenebilir")

    contents = file.file.read()
    if len(contents) > 2 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Logo en fazla 2MB olabilir")

    settings.logos_path.mkdir(parents=True, exist_ok=True)
    current = get_theme_settings(db)
    old_filename = _extract_filename_from_logo_url(current.logo_url)

    filename = f"{uuid4().hex}{extension}"
    output_path = settings.logos_path / filename
    output_path.write_bytes(contents)

    if old_filename:
        old_path = settings.logos_path / old_filename
        if old_path.exists():
            old_path.unlink()

    _upsert_setting(db, "theme.logo_url", f"/api/v1/settings/theme/logo/{filename}")
    db.commit()
    return get_theme_settings(db)


def delete_theme_logo(db: Session) -> ThemeSettingsResponse:
    current = get_theme_settings(db)
    old_filename = _extract_filename_from_logo_url(current.logo_url)
    if old_filename:
        old_path = settings.logos_path / old_filename
        if old_path.exists():
            old_path.unlink()
    _upsert_setting(db, "theme.logo_url", None)
    db.commit()
    return get_theme_settings(db)


def _mask_api_key(value: str | None) -> str | None:
    if not value:
        return None
    suffix = value[-4:] if len(value) >= 4 else value
    return f"{'*' * max(len(value) - len(suffix), 4)}{suffix}"


def get_tmdb_settings(db: Session) -> TmdbSettingsResponse:
    language = get_setting(db, "tmdb.language", DEFAULT_TMDB_LANGUAGE) or DEFAULT_TMDB_LANGUAGE
    encrypted_api_key = get_setting(db, "tmdb.api_key")
    api_key = decrypt_secret(encrypted_api_key) if encrypted_api_key else None
    return TmdbSettingsResponse(
        api_key_masked=_mask_api_key(api_key),
        has_api_key=bool(api_key),
        language=language,
    )


def update_tmdb_settings(db: Session, payload: TmdbSettingsUpdate) -> TmdbSettingsResponse:
    if payload.api_key is not None:
        api_key = payload.api_key.strip()
        _upsert_setting(db, "tmdb.api_key", encrypt_secret(api_key) if api_key else None)
    _upsert_setting(db, "tmdb.language", payload.language)
    db.commit()
    return get_tmdb_settings(db)


def test_tmdb_settings(db: Session) -> TmdbTestResponse:
    encrypted_api_key = get_setting(db, "tmdb.api_key")
    if not encrypted_api_key:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="TMDB API key kaydedilmemis")

    api_key = decrypt_secret(encrypted_api_key)
    language = get_setting(db, "tmdb.language", DEFAULT_TMDB_LANGUAGE) or DEFAULT_TMDB_LANGUAGE

    try:
        with httpx.Client(base_url="https://api.themoviedb.org/3", timeout=15.0) as client:
            client.get("/configuration", params={"api_key": api_key}).raise_for_status()
            response = client.get("/movie/popular", params={"api_key": api_key, "language": language, "page": 1})
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"TMDB testi basarisiz: {exc.response.text}",
        ) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"TMDB baglantisi kurulamadi: {exc}",
        ) from exc

    sample_title = None
    results = data.get("results") or []
    if results:
        sample_title = results[0].get("title") or results[0].get("name")

    return TmdbTestResponse(
        success=True,
        message="TMDB baglantisi basarili",
        language=language,
        sample_title=sample_title,
    )


def _get_youtube_record(db: Session) -> YoutubeCookieCredential | None:
    return db.query(YoutubeCookieCredential).order_by(YoutubeCookieCredential.id.desc()).first()


def _get_youtube_mode(db: Session) -> str | None:
    return get_setting(db, "youtube.cookies_mode")


def _set_youtube_mode(db: Session, mode: str | None) -> None:
    _upsert_setting(db, "youtube.cookies_mode", mode)


def _serialize_youtube_status(
    record: YoutubeCookieCredential | None,
    message: str | None = None,
    mode: str | None = None,
) -> YoutubeSettingsResponse:
    if mode is None and record is not None:
        mode = "manual" if record.email == "manual-cookies@local" else "automatic"
    if record is None:
        return YoutubeSettingsResponse(
            email=None,
            mode=mode,
            status="expired",
            last_refresh_at=None,
            next_refresh_at=None,
            error_message=None,
            cookies_available=False,
            has_credentials=False,
            updated_at=None,
            message=message,
        )

    effective_status = record.status.value
    now = datetime.now(timezone.utc)
    if record.next_refresh_at and record.next_refresh_at < now and record.status == YoutubeCookieStatus.active:
        effective_status = YoutubeCookieStatus.expired.value

    cookies_path = Path(record.cookies_file_path) if record.cookies_file_path else None
    cookies_available = bool(cookies_path and cookies_path.exists())

    return YoutubeSettingsResponse(
        email=record.email,
        mode=mode,
        status=effective_status,
        last_refresh_at=record.last_refresh_at,
        next_refresh_at=record.next_refresh_at,
        error_message=record.error_message,
        cookies_available=cookies_available,
        has_credentials=bool(record.password_encrypted),
        updated_at=record.updated_at,
        message=message,
    )


def get_youtube_settings(db: Session) -> YoutubeSettingsResponse:
    record = _get_youtube_record(db)
    response = _serialize_youtube_status(record, mode=_get_youtube_mode(db))
    response.mode = response.mode or ("manual" if record and record.email == "manual-cookies@local" else "automatic" if record else None)
    if response.mode == "manual":
        response.has_credentials = False
        response.email = None if response.email == "manual-cookies@local" else response.email
        response.next_refresh_at = None
    return response


def _validate_netscape_cookie_text(cookies_text: str) -> str:
    normalized = cookies_text.replace("\r\n", "\n").strip()
    if not normalized:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cookies icerigi bos olamaz")

    meaningful_lines = [line for line in normalized.splitlines() if line.strip() and not line.startswith("#")]
    if not meaningful_lines:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Gecerli Netscape cookies bulunamadi")

    invalid_line = next((line for line in meaningful_lines if len(line.split("\t")) < 7), None)
    if invalid_line is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cookies dosyasi Netscape formatinda olmali")

    header = normalized.splitlines()[0]
    if "netscape" not in header.lower() and not normalized.startswith("."):
        normalized = "# Netscape HTTP Cookie File\n" + normalized

    return normalized + ("\n" if not normalized.endswith("\n") else "")


def _save_manual_youtube_record(db: Session, cookies_path: Path) -> YoutubeSettingsResponse:
    record = _get_youtube_record(db)
    now = datetime.now(timezone.utc)
    if record is None:
        record = YoutubeCookieCredential(
            email="manual-cookies@local",
            password_encrypted=encrypt_secret("manual-cookies"),
            status=YoutubeCookieStatus.active,
        )
        db.add(record)
        db.commit()
        db.refresh(record)

    record.email = "manual-cookies@local"
    record.password_encrypted = encrypt_secret("manual-cookies")
    record.cookies_file_path = str(cookies_path)
    record.cookies_json = None
    record.status = YoutubeCookieStatus.active
    record.error_message = None
    record.last_refresh_at = now
    record.next_refresh_at = None
    db.add(record)
    _set_youtube_mode(db, "manual")
    db.commit()
    db.refresh(record)
    response = _serialize_youtube_status(record, "YouTube cookies kaydedildi", mode="manual")
    response.mode = "manual"
    response.email = None
    response.has_credentials = False
    response.next_refresh_at = None
    return response


def save_youtube_cookies_text(db: Session, cookies_text: str) -> YoutubeSettingsResponse:
    normalized = _validate_netscape_cookie_text(cookies_text)
    settings.youtube_cookies_path.parent.mkdir(parents=True, exist_ok=True)
    settings.youtube_cookies_path.write_text(normalized, encoding="utf-8")
    os.chmod(settings.youtube_cookies_path, 0o600)
    return _save_manual_youtube_record(db, settings.youtube_cookies_path)


def save_youtube_cookies_file(db: Session, file: UploadFile) -> YoutubeSettingsResponse:
    extension = Path(file.filename or "").suffix.lower()
    if extension and extension not in {".txt", ".cookies"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cookies dosyasi .txt veya .cookies olmali")
    contents = file.file.read()
    if not contents:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Bos dosya yuklenemez")
    if len(contents) > 2 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cookies dosyasi en fazla 2MB olabilir")
    try:
        text = contents.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cookies dosyasi UTF-8 olmali") from exc
    return save_youtube_cookies_text(db, text)


def _to_netscape_expiry(cookie: dict) -> int:
    expires = cookie.get("expires")
    if isinstance(expires, int):
        return expires
    if isinstance(expires, float):
        return int(expires)
    return 0


def _write_netscape_cookie_file(cookies: list[dict], output_path: Path) -> None:
    lines = ["# Netscape HTTP Cookie File", ""]
    for cookie in cookies:
        domain = cookie.get("domain", "")
        include_subdomains = "TRUE" if domain.startswith(".") else "FALSE"
        path = cookie.get("path", "/")
        secure = "TRUE" if cookie.get("secure") else "FALSE"
        expires = _to_netscape_expiry(cookie)
        name = cookie.get("name", "")
        value = cookie.get("value", "")
        lines.append("\t".join([domain, include_subdomains, path, secure, str(expires), name, value]))

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    os.chmod(output_path, 0o600)


def _capture_youtube_cookies(email: str, password: str) -> list[dict]:
    try:
        from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
        from playwright.sync_api import sync_playwright
    except ImportError as exc:
        raise RuntimeError("Playwright kurulu degil") from exc

    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(
                headless=True,
                args=["--disable-blink-features=AutomationControlled"],
            )
            context = browser.new_context(locale="tr-TR")
            page = context.new_page()
            page.set_default_timeout(YOUTUBE_LOGIN_TIMEOUT_MS)
            page.set_default_navigation_timeout(YOUTUBE_LOGIN_TIMEOUT_MS)
            try:
                from playwright_stealth import stealth_sync

                stealth_sync(page)
            except ImportError:
                pass
            page.goto(
                "https://accounts.google.com/ServiceLogin?service=youtube",
                wait_until="domcontentloaded",
                timeout=YOUTUBE_LOGIN_TIMEOUT_MS,
            )
            page.fill('input[type="email"]', email)
            page.click("#identifierNext")
            page.wait_for_timeout(3000)
            page.fill('input[type="password"]', password)
            page.click("#passwordNext")
            page.wait_for_load_state("networkidle", timeout=YOUTUBE_LOGIN_TIMEOUT_MS)
            page.goto("https://www.youtube.com", wait_until="networkidle", timeout=YOUTUBE_LOGIN_TIMEOUT_MS)
            if "challenge" in page.url or "signin" in page.url:
                raise RuntimeError("Google girisi ek dogrulama gerektiriyor")
            cookies = context.cookies(["https://www.youtube.com", "https://accounts.google.com"])
            browser.close()
            if not cookies:
                raise RuntimeError("Herhangi bir YouTube cookie bilgisi alinamadi")
            return cookies
    except PlaywrightTimeoutError as exc:
        raise RuntimeError("Google girisi zaman asimina ugradi") from exc
    except Exception as exc:
        raise RuntimeError(str(exc)) from exc


def _refresh_record(db: Session, record: YoutubeCookieCredential) -> YoutubeCookieCredential:
    email = record.email
    password = decrypt_secret(record.password_encrypted)
    now = datetime.now(timezone.utc)

    try:
        cookies = _capture_youtube_cookies(email, password)
        _write_netscape_cookie_file(cookies, settings.youtube_cookies_path)
        record.cookies_json = encrypt_secret(json.dumps(cookies))
        record.cookies_file_path = str(settings.youtube_cookies_path)
        record.last_refresh_at = now
        record.next_refresh_at = now + timedelta(minutes=YOUTUBE_REFRESH_INTERVAL_MINUTES)
        record.status = YoutubeCookieStatus.active
        record.error_message = None
    except Exception as exc:
        record.status = YoutubeCookieStatus.error
        record.error_message = str(exc)
        record.next_refresh_at = now + timedelta(minutes=YOUTUBE_REFRESH_INTERVAL_MINUTES)

    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def login_youtube(db: Session, payload: YoutubeLoginRequest) -> YoutubeSettingsResponse:
    record = _get_youtube_record(db)
    if record is None:
        record = YoutubeCookieCredential(
            email=payload.email,
            password_encrypted=encrypt_secret(payload.password),
            status=YoutubeCookieStatus.error,
        )
        db.add(record)
        db.commit()
        db.refresh(record)
    else:
        record.email = payload.email
        record.password_encrypted = encrypt_secret(payload.password)
        db.add(record)
    _set_youtube_mode(db, "automatic")
    db.commit()
    db.refresh(record)

    refreshed = _refresh_record(db, record)
    response = _serialize_youtube_status(refreshed, "YouTube cookies guncellendi", mode="automatic")
    return response


def refresh_youtube(db: Session) -> YoutubeSettingsResponse:
    if _get_youtube_mode(db) == "manual":
        return get_youtube_settings(db)
    record = _get_youtube_record(db)
    if record is None or not record.password_encrypted:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Kayitli YouTube hesabi bulunamadi")
    refreshed = _refresh_record(db, record)
    response = _serialize_youtube_status(refreshed, "YouTube cookies yenilendi", mode="automatic")
    return response


def delete_youtube(db: Session) -> YoutubeSettingsResponse:
    record = _get_youtube_record(db)
    if record is None:
        return _serialize_youtube_status(None, "YouTube ayari temizlendi", mode=None)

    if record.cookies_file_path:
        cookies_path = Path(record.cookies_file_path)
        if cookies_path.exists():
            cookies_path.unlink()

    db.delete(record)
    _set_youtube_mode(db, None)
    db.commit()
    return _serialize_youtube_status(None, "YouTube ayari temizlendi", mode=None)


def refresh_due_youtube_cookies() -> int:
    db = SessionLocal()
    try:
        if _get_youtube_mode(db) == "manual":
            return 0
        records = db.query(YoutubeCookieCredential).all()
        refreshed = 0
        now = datetime.now(timezone.utc)
        for record in records:
            if record.email == "manual-cookies@local":
                continue
            if record.next_refresh_at and record.next_refresh_at > now and record.status == YoutubeCookieStatus.active:
                continue
            _refresh_record(db, record)
            refreshed += 1
        return refreshed
    finally:
        db.close()
