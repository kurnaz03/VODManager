from app.core.celery_app import celery_app


@celery_app.task(
    name="app.modules.content.tasks.download_music_youtube",
    bind=True,
)
def download_music_youtube(
    self,
    url: str,
    title: str | None,
    artist: str | None,
    category_id: int | None,
    vpn_client_id: int | None,
) -> dict:
    """YouTube'dan MP3 indir ve MusicTrack olarak kaydet."""
    from app.modules.content.music_download import download_music_from_youtube

    try:
        return download_music_from_youtube(
            url=url,
            title=title,
            artist=artist,
            category_id=category_id,
            vpn_client_id=vpn_client_id,
        )
    except Exception as exc:
        return {
            "status": "failed",
            "error": str(exc),
        }
