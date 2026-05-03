import os
import shutil
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings

from app.modules.content.models import (
    Bouquet,
    BouquetCategory,
    BouquetItem,
    BouquetItemType,
    BouquetType,
    MovieCategory,
    MovieContent,
    MusicPlaylist,
    MusicPlaylistItem,
    MusicTrack,
    RadioCategory,
    RadioContent,
    SeriesCategory,
    SeriesContent,
    SeriesEpisode,
    SeriesSeason,
    TvCategory,
    TvContent,
)
from app.modules.content.schemas import (
    BouquetCategoriesBulkUpdate,
    BouquetCategoryCreate,
    BouquetCreate,
    BouquetItemBulkCreate,
    BouquetItemCreate,
    BouquetUpdate,
    CategoryCreate,
    CategoryUpdate,
    EpisodeCreate,
    EpisodeUpdate,
    MovieContentCreate,
    MovieContentUpdate,
    MusicPlaylistCreate,
    MusicPlaylistItemCreate,
    MusicPlaylistUpdate,
    MusicTrackCreate,
    MusicTrackUpdate,
    RadioContentCreate,
    RadioContentUpdate,
    SeasonCreate,
    SeriesContentCreate,
    SeriesContentUpdate,
    StreamContentCreate,
    StreamContentUpdate,
)


CATEGORY_MODELS = {
    "movies": MovieCategory,
    "series": SeriesCategory,
    "tv": TvCategory,
    "radio": RadioCategory,
}


def _get_category_model(category_type: str):
    model = CATEGORY_MODELS.get(category_type)
    if model is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kategori tipi bulunamadi")
    return model


def _category_to_dict(category: Any) -> dict[str, Any]:
    return {
        "id": category.id,
        "name": category.name,
        "description": category.description,
        "icon": category.icon,
        "sort_order": category.sort_order,
        "is_active": category.is_active,
        "created_at": category.created_at,
        "updated_at": category.updated_at,
    }


def list_categories(db: Session, category_type: str, include_hidden: bool = False) -> list[dict[str, Any]]:
    model = _get_category_model(category_type)
    query = db.query(model)
    if not include_hidden:
        query = query.filter(model.is_hidden == False)  # noqa: E712
    categories = query.order_by(model.sort_order.asc(), model.name.asc()).all()
    return [_category_to_dict(category) for category in categories]


def create_category(db: Session, category_type: str, payload: CategoryCreate) -> dict[str, Any]:
    model = _get_category_model(category_type)
    existing = db.query(model).filter(func.lower(model.name) == payload.name.strip().lower()).first()
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Bu kategori adi zaten mevcut")
    category = model(
        name=payload.name.strip(),
        description=payload.description.strip() if payload.description else None,
        icon=payload.icon.strip() if payload.icon else None,
        sort_order=payload.sort_order,
        is_active=payload.is_active,
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return _category_to_dict(category)


def _get_category(db: Session, category_type: str, category_id: int):
    model = _get_category_model(category_type)
    category = db.query(model).filter(model.id == category_id).first()
    if category is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kategori bulunamadi")
    return category


def update_category(db: Session, category_type: str, category_id: int, payload: CategoryUpdate) -> dict[str, Any]:
    model = _get_category_model(category_type)
    category = _get_category(db, category_type, category_id)
    if payload.name is not None:
        existing = (
            db.query(model)
            .filter(func.lower(model.name) == payload.name.strip().lower(), model.id != category_id)
            .first()
        )
        if existing is not None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Bu kategori adi zaten mevcut")
        category.name = payload.name.strip()
    if payload.description is not None:
        category.description = payload.description.strip() or None
    if payload.icon is not None:
        category.icon = payload.icon.strip() or None
    if payload.sort_order is not None:
        category.sort_order = payload.sort_order
    if payload.is_active is not None:
        category.is_active = payload.is_active
    db.add(category)
    db.commit()
    db.refresh(category)
    return _category_to_dict(category)


def delete_category(db: Session, category_type: str, category_id: int) -> None:
    category = _get_category(db, category_type, category_id)
    (
        db.query(BouquetCategory)
        .filter(BouquetCategory.category_type == category_type, BouquetCategory.category_id == category_id)
        .delete()
    )
    db.delete(category)
    db.commit()


def _get_category_snapshot(db: Session, category_type: str, category_id: int) -> dict[str, Any]:
    category = _get_category(db, category_type, category_id)
    return {
        "id": category.id,
        "name": category.name,
        "description": category.description,
        "icon": category.icon,
        "is_active": category.is_active,
    }


def _validate_bouquet_category_type(bouquet: Bouquet, category_type: str) -> None:
    if bouquet.bouquet_type != BouquetType.mixed and bouquet.bouquet_type.value != category_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu bouquet tipi secilen kategori tipini kabul etmiyor",
        )


def _serialize_bouquet_category(db: Session, assignment: BouquetCategory) -> dict[str, Any]:
    category = _get_category_snapshot(db, assignment.category_type, assignment.category_id)
    return {
        "id": assignment.id,
        "category_type": assignment.category_type,
        "category_id": assignment.category_id,
        "sort_order": assignment.sort_order,
        "category_name": category["name"],
        "category_description": category["description"],
        "icon": category["icon"],
        "is_active": category["is_active"],
        "created_at": assignment.created_at,
    }


def _serialize_bouquet_summary(bouquet: Bouquet) -> dict[str, Any]:
    return {
        "id": bouquet.id,
        "name": bouquet.name,
        "description": bouquet.description,
        "bouquet_type": bouquet.bouquet_type.value if hasattr(bouquet.bouquet_type, "value") else bouquet.bouquet_type,
        "is_active": bouquet.is_active,
        "sort_order": bouquet.sort_order,
        "category_count": len(bouquet.categories),
        "item_count": len(bouquet.items),
        "created_at": bouquet.created_at,
        "updated_at": bouquet.updated_at,
    }


def _serialize_bouquet_detail(db: Session, bouquet: Bouquet) -> dict[str, Any]:
    return {
        "id": bouquet.id,
        "name": bouquet.name,
        "description": bouquet.description,
        "bouquet_type": bouquet.bouquet_type.value if hasattr(bouquet.bouquet_type, "value") else bouquet.bouquet_type,
        "is_active": bouquet.is_active,
        "sort_order": bouquet.sort_order,
        "categories": [_serialize_bouquet_category(db, assignment) for assignment in bouquet.categories],
        "created_at": bouquet.created_at,
        "updated_at": bouquet.updated_at,
    }


def list_bouquets(db: Session) -> list[dict[str, Any]]:
    bouquets = (
        db.query(Bouquet)
        .options(joinedload(Bouquet.categories), joinedload(Bouquet.items))
        .order_by(Bouquet.sort_order.asc(), Bouquet.name.asc())
        .all()
    )
    return [_serialize_bouquet_summary(bouquet) for bouquet in bouquets]


def create_bouquet(db: Session, payload: BouquetCreate) -> dict[str, Any]:
    bouquet = Bouquet(
        name=payload.name.strip(),
        description=payload.description.strip() if payload.description else None,
        bouquet_type=BouquetType(payload.bouquet_type),
        is_active=payload.is_active,
        sort_order=payload.sort_order,
    )
    db.add(bouquet)
    db.commit()
    return _serialize_bouquet_summary(_get_bouquet(db, bouquet.id))


def _get_bouquet(db: Session, bouquet_id: int) -> Bouquet:
    bouquet = (
        db.query(Bouquet)
        .options(joinedload(Bouquet.categories), joinedload(Bouquet.items))
        .filter(Bouquet.id == bouquet_id)
        .first()
    )
    if bouquet is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bouquet bulunamadi")
    return bouquet


def get_bouquet(db: Session, bouquet_id: int) -> dict[str, Any]:
    bouquet = _get_bouquet(db, bouquet_id)
    return _serialize_bouquet_detail(db, bouquet)


def update_bouquet(db: Session, bouquet_id: int, payload: BouquetUpdate) -> dict[str, Any]:
    bouquet = _get_bouquet(db, bouquet_id)
    if payload.name is not None:
        bouquet.name = payload.name.strip()
    if payload.description is not None:
        bouquet.description = payload.description.strip() or None
    if payload.bouquet_type is not None:
        bouquet.bouquet_type = BouquetType(payload.bouquet_type)
        invalid_assignments = [
            assignment
            for assignment in bouquet.categories
            if bouquet.bouquet_type != BouquetType.mixed and assignment.category_type != bouquet.bouquet_type.value
        ]
        for assignment in invalid_assignments:
            db.delete(assignment)
    if payload.is_active is not None:
        bouquet.is_active = payload.is_active
    if payload.sort_order is not None:
        bouquet.sort_order = payload.sort_order
    db.add(bouquet)
    db.commit()
    db.refresh(bouquet)
    return _serialize_bouquet_detail(db, _get_bouquet(db, bouquet_id))


def delete_bouquet(db: Session, bouquet_id: int) -> None:
    bouquet = _get_bouquet(db, bouquet_id)
    db.delete(bouquet)
    db.commit()


def add_bouquet_category(db: Session, bouquet_id: int, payload: BouquetCategoryCreate) -> dict[str, Any]:
    bouquet = _get_bouquet(db, bouquet_id)
    _validate_bouquet_category_type(bouquet, payload.category_type)
    _get_category(db, payload.category_type, payload.category_id)
    existing = (
        db.query(BouquetCategory)
        .filter(
            BouquetCategory.bouquet_id == bouquet_id,
            BouquetCategory.category_type == payload.category_type,
            BouquetCategory.category_id == payload.category_id,
        )
        .first()
    )
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Kategori zaten bouquet icinde mevcut")
    assignment = BouquetCategory(
        bouquet_id=bouquet_id,
        category_type=payload.category_type,
        category_id=payload.category_id,
        sort_order=payload.sort_order,
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return _serialize_bouquet_category(db, assignment)


def remove_bouquet_category(db: Session, bouquet_id: int, category_type: str, category_id: int) -> None:
    _get_bouquet(db, bouquet_id)
    assignment = (
        db.query(BouquetCategory)
        .filter(
            BouquetCategory.bouquet_id == bouquet_id,
            BouquetCategory.category_type == category_type,
            BouquetCategory.category_id == category_id,
        )
        .first()
    )
    if assignment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bouquet kategorisi bulunamadi")
    db.delete(assignment)
    db.commit()


def replace_bouquet_categories(db: Session, bouquet_id: int, payload: BouquetCategoriesBulkUpdate) -> dict[str, Any]:
    bouquet = _get_bouquet(db, bouquet_id)
    seen_pairs: set[tuple[str, int]] = set()
    for item in payload.categories:
        _validate_bouquet_category_type(bouquet, item.category_type)
        _get_category(db, item.category_type, item.category_id)
        pair = (item.category_type, item.category_id)
        if pair in seen_pairs:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ayni kategori birden fazla kez gonderildi")
        seen_pairs.add(pair)

    db.query(BouquetCategory).filter(BouquetCategory.bouquet_id == bouquet_id).delete()
    for index, item in enumerate(payload.categories, start=1):
        db.add(
            BouquetCategory(
                bouquet_id=bouquet_id,
                category_type=item.category_type,
                category_id=item.category_id,
                sort_order=item.sort_order if item.sort_order > 0 else index,
            )
        )
    db.commit()
    return _serialize_bouquet_detail(db, _get_bouquet(db, bouquet_id))


# ── Bouquet Items Service ─────────────────────────────────────────────────────

def _get_item_metadata(db: Session, item_type: str, item_id: int) -> tuple[str | None, str | None]:
    """Returns (title, logo_url) for the given item."""
    try:
        if item_type == "tv":
            obj = db.query(TvContent).filter(TvContent.id == item_id).first()
            return (obj.title, obj.logo_url) if obj else (None, None)
        elif item_type == "radio":
            obj = db.query(RadioContent).filter(RadioContent.id == item_id).first()
            return (obj.title, obj.logo_url) if obj else (None, None)
        elif item_type == "movie":
            obj = db.query(MovieContent).filter(MovieContent.id == item_id).first()
            return (obj.title, obj.poster_url) if obj else (None, None)
        elif item_type == "series":
            obj = db.query(SeriesContent).filter(SeriesContent.id == item_id).first()
            return (obj.title, obj.poster_url) if obj else (None, None)
        elif item_type == "vod_channel":
            from app.modules.playlist.models import Playlist
            obj = db.query(Playlist).filter(Playlist.id == item_id).first()
            return (obj.name, None) if obj else (None, None)
    except Exception:
        pass
    return (None, None)


def _serialize_bouquet_item(db: Session, item: BouquetItem) -> dict[str, Any]:
    item_type_val = item.item_type.value if hasattr(item.item_type, "value") else item.item_type
    title, logo = _get_item_metadata(db, item_type_val, item.item_id)
    return {
        "id": item.id,
        "bouquet_id": item.bouquet_id,
        "item_type": item_type_val,
        "item_id": item.item_id,
        "position": item.position,
        "item_title": title,
        "item_logo": logo,
        "created_at": item.created_at,
    }


def list_bouquet_items(db: Session, bouquet_id: int) -> list[dict[str, Any]]:
    _get_bouquet(db, bouquet_id)
    items = (
        db.query(BouquetItem)
        .filter(BouquetItem.bouquet_id == bouquet_id)
        .order_by(BouquetItem.position.asc(), BouquetItem.id.asc())
        .all()
    )
    return [_serialize_bouquet_item(db, item) for item in items]


def add_bouquet_items(db: Session, bouquet_id: int, payload: BouquetItemBulkCreate) -> list[dict[str, Any]]:
    _get_bouquet(db, bouquet_id)
    existing = {
        (bi.item_type.value if hasattr(bi.item_type, "value") else bi.item_type, bi.item_id)
        for bi in db.query(BouquetItem).filter(BouquetItem.bouquet_id == bouquet_id).all()
    }
    # max position
    max_pos_row = db.query(func.max(BouquetItem.position)).filter(BouquetItem.bouquet_id == bouquet_id).scalar()
    next_pos = (max_pos_row or 0) + 1
    added = []
    for item_data in payload.items:
        key = (item_data.item_type, item_data.item_id)
        if key in existing:
            continue
        existing.add(key)
        bi = BouquetItem(
            bouquet_id=bouquet_id,
            item_type=BouquetItemType(item_data.item_type),
            item_id=item_data.item_id,
            position=item_data.position if item_data.position > 0 else next_pos,
        )
        next_pos += 1
        db.add(bi)
        added.append(bi)
    db.commit()
    return [_serialize_bouquet_item(db, bi) for bi in added]


def remove_bouquet_item(db: Session, bouquet_id: int, item_id: int) -> None:
    _get_bouquet(db, bouquet_id)
    bi = db.query(BouquetItem).filter(BouquetItem.id == item_id, BouquetItem.bouquet_id == bouquet_id).first()
    if bi is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bouquet medya ögesi bulunamadi")
    db.delete(bi)
    db.commit()


# ── Movie Content Service ─────────────────────────────────────────────────────

def _serialize_movie_content(item: MovieContent) -> dict[str, Any]:
    return {
        "id": item.id,
        "title": item.title,
        "description": item.description,
        "category_id": item.category_id,
        "category_name": item.category.name if item.category else None,
        "tmdb_id": item.tmdb_id,
        "poster_url": item.poster_url,
        "backdrop_url": item.backdrop_url,
        "release_year": item.release_year,
        "rating": item.rating,
        "resolution": item.resolution,
        "audio_bitrate": item.audio_bitrate,
        "file_path": item.file_path,
        "file_size_bytes": item.file_size_bytes,
        "source_url": item.source_url,
        "is_public": item.is_public,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


def list_movie_contents(db: Session, category_id: int | None = None) -> list[dict[str, Any]]:
    query = db.query(MovieContent).options(joinedload(MovieContent.category)).order_by(MovieContent.created_at.desc())
    if category_id is not None:
        query = query.filter(MovieContent.category_id == category_id)
    return [_serialize_movie_content(item) for item in query.all()]


def create_movie_content(db: Session, payload: MovieContentCreate) -> dict[str, Any]:
    item = MovieContent(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return _serialize_movie_content(db.query(MovieContent).options(joinedload(MovieContent.category)).filter(MovieContent.id == item.id).first())


def update_movie_content(db: Session, movie_id: int, payload: MovieContentUpdate) -> dict[str, Any]:
    item = db.query(MovieContent).filter(MovieContent.id == movie_id).first()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Film bulunamadi")
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(item, key, value)
    db.add(item)
    db.commit()
    db.refresh(item)
    return _serialize_movie_content(db.query(MovieContent).options(joinedload(MovieContent.category)).filter(MovieContent.id == item.id).first())


def delete_movie_content(db: Session, movie_id: int) -> None:
    item = db.query(MovieContent).filter(MovieContent.id == movie_id).first()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Film bulunamadi")
    db.delete(item)
    db.commit()


# ── Series Content Service ────────────────────────────────────────────────────

def _serialize_series(item: SeriesContent) -> dict[str, Any]:
    return {
        "id": item.id,
        "title": item.title,
        "description": item.description,
        "category_id": item.category_id,
        "category_name": item.category.name if item.category else None,
        "tmdb_id": item.tmdb_id,
        "poster_url": item.poster_url,
        "backdrop_url": item.backdrop_url,
        "release_year": item.release_year,
        "rating": item.rating,
        "season_count": len(item.seasons),
        "broadcast_day": item.broadcast_day,
        "broadcast_channel": item.broadcast_channel,
        "channel_logo_url": item.channel_logo_url,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


def _serialize_season(season: SeriesSeason) -> dict[str, Any]:
    return {
        "id": season.id,
        "series_id": season.series_id,
        "season_number": season.season_number,
        "title": season.title,
        "episode_count": len(season.episodes),
        "created_at": season.created_at,
    }


def _serialize_episode(ep: SeriesEpisode) -> dict[str, Any]:
    return {
        "id": ep.id,
        "season_id": ep.season_id,
        "episode_number": ep.episode_number,
        "title": ep.title,
        "duration": ep.duration,
        "resolution": ep.resolution,
        "audio_bitrate": ep.audio_bitrate,
        "file_path": ep.file_path,
        "source_url": ep.source_url,
        "created_at": ep.created_at,
    }


def list_series(db: Session, category_id: int | None = None) -> list[dict[str, Any]]:
    query = (
        db.query(SeriesContent)
        .options(joinedload(SeriesContent.category), joinedload(SeriesContent.seasons))
        .order_by(SeriesContent.created_at.desc())
    )
    if category_id is not None:
        query = query.filter(SeriesContent.category_id == category_id)
    return [_serialize_series(item) for item in query.all()]


def list_series_by_broadcast_day(db: Session, day_name: str) -> list[dict[str, Any]]:
    items = (
        db.query(SeriesContent)
        .options(joinedload(SeriesContent.category), joinedload(SeriesContent.seasons))
        .filter(SeriesContent.broadcast_day == day_name)
        .order_by(SeriesContent.title.asc())
        .all()
    )
    return [_serialize_series(item) for item in items]


def create_series(db: Session, payload: SeriesContentCreate) -> dict[str, Any]:
    item = SeriesContent(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return _serialize_series(
        db.query(SeriesContent)
        .options(joinedload(SeriesContent.category), joinedload(SeriesContent.seasons))
        .filter(SeriesContent.id == item.id)
        .first()
    )


def update_series(db: Session, series_id: int, payload: SeriesContentUpdate) -> dict[str, Any]:
    item = db.query(SeriesContent).options(joinedload(SeriesContent.category), joinedload(SeriesContent.seasons)).filter(SeriesContent.id == series_id).first()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dizi bulunamadi")
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(item, key, value)
    db.add(item)
    db.commit()
    db.refresh(item)
    return _serialize_series(
        db.query(SeriesContent)
        .options(joinedload(SeriesContent.category), joinedload(SeriesContent.seasons))
        .filter(SeriesContent.id == series_id)
        .first()
    )


def delete_series(db: Session, series_id: int) -> None:
    item = (
        db.query(SeriesContent)
        .options(joinedload(SeriesContent.seasons).joinedload(SeriesSeason.episodes))
        .filter(SeriesContent.id == series_id)
        .first()
    )
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dizi bulunamadi")

    # Delete individual episode files
    for season in item.seasons:
        for ep in season.episodes:
            if ep.file_path and os.path.exists(ep.file_path):
                try:
                    os.remove(ep.file_path)
                except OSError:
                    pass

    # Delete the series folder (series_{id})
    series_dir = settings.movies_uploads_path / f"series_{series_id}"
    if series_dir.exists():
        try:
            shutil.rmtree(series_dir)
        except OSError:
            pass

    db.delete(item)
    db.commit()


def list_seasons(db: Session, series_id: int) -> list[dict[str, Any]]:
    series = db.query(SeriesContent).filter(SeriesContent.id == series_id).first()
    if series is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dizi bulunamadi")
    seasons = db.query(SeriesSeason).options(joinedload(SeriesSeason.episodes)).filter(SeriesSeason.series_id == series_id).order_by(SeriesSeason.season_number.asc()).all()
    return [_serialize_season(s) for s in seasons]


def create_season(db: Session, series_id: int, payload: SeasonCreate) -> dict[str, Any]:
    series = db.query(SeriesContent).filter(SeriesContent.id == series_id).first()
    if series is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dizi bulunamadi")
    season = SeriesSeason(series_id=series_id, season_number=payload.season_number, title=payload.title)
    db.add(season)
    db.commit()
    db.refresh(season)
    return _serialize_season(db.query(SeriesSeason).options(joinedload(SeriesSeason.episodes)).filter(SeriesSeason.id == season.id).first())


def delete_season(db: Session, series_id: int, season_id: int) -> None:
    season = (
        db.query(SeriesSeason)
        .options(joinedload(SeriesSeason.episodes))
        .filter(SeriesSeason.id == season_id, SeriesSeason.series_id == series_id)
        .first()
    )
    if season is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sezon bulunamadi")

    # Delete episode files for this season
    for ep in season.episodes:
        if ep.file_path and os.path.exists(ep.file_path):
            try:
                os.remove(ep.file_path)
            except OSError:
                pass

    db.delete(season)
    db.commit()


def list_episodes(db: Session, season_id: int) -> list[dict[str, Any]]:
    episodes = db.query(SeriesEpisode).filter(SeriesEpisode.season_id == season_id).order_by(SeriesEpisode.episode_number.asc()).all()
    return [_serialize_episode(ep) for ep in episodes]


def create_episode(db: Session, season_id: int, payload: EpisodeCreate) -> dict[str, Any]:
    season = db.query(SeriesSeason).filter(SeriesSeason.id == season_id).first()
    if season is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sezon bulunamadi")
    ep = SeriesEpisode(season_id=season_id, **payload.model_dump())
    db.add(ep)
    db.commit()
    db.refresh(ep)
    return _serialize_episode(ep)


def update_episode(db: Session, episode_id: int, payload: EpisodeUpdate) -> dict[str, Any]:
    ep = db.query(SeriesEpisode).filter(SeriesEpisode.id == episode_id).first()
    if ep is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bolum bulunamadi")
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(ep, key, value)
    db.add(ep)
    db.commit()
    db.refresh(ep)
    return _serialize_episode(ep)


def delete_episode(db: Session, episode_id: int) -> None:
    ep = db.query(SeriesEpisode).filter(SeriesEpisode.id == episode_id).first()
    if ep is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bolum bulunamadi")

    # Delete physical file if exists
    if ep.file_path and os.path.exists(ep.file_path):
        try:
            os.remove(ep.file_path)
        except OSError:
            pass

    db.delete(ep)
    db.commit()


def get_episode_raw(db: Session, episode_id: int) -> SeriesEpisode:
    ep = db.query(SeriesEpisode).filter(SeriesEpisode.id == episode_id).first()
    if ep is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bolum bulunamadi")
    return ep


# ── TV Content Service ────────────────────────────────────────────────────────

def _serialize_tv(item: TvContent) -> dict[str, Any]:
    return {
        "id": item.id,
        "title": item.title,
        "description": item.description,
        "category_id": item.category_id,
        "category_name": item.category.name if item.category else None,
        "logo_url": item.logo_url,
        "stream_url": item.stream_url,
        "is_public": item.is_public,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


def list_tv_contents(db: Session, category_id: int | None = None) -> list[dict[str, Any]]:
    query = db.query(TvContent).options(joinedload(TvContent.category)).order_by(TvContent.created_at.desc())
    if category_id is not None:
        query = query.filter(TvContent.category_id == category_id)
    return [_serialize_tv(item) for item in query.all()]


def create_tv_content(db: Session, payload: StreamContentCreate) -> dict[str, Any]:
    item = TvContent(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return _serialize_tv(db.query(TvContent).options(joinedload(TvContent.category)).filter(TvContent.id == item.id).first())


def update_tv_content(db: Session, tv_id: int, payload: StreamContentUpdate) -> dict[str, Any]:
    item = db.query(TvContent).options(joinedload(TvContent.category)).filter(TvContent.id == tv_id).first()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="TV icerigi bulunamadi")
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(item, key, value)
    db.add(item)
    db.commit()
    db.refresh(item)
    return _serialize_tv(db.query(TvContent).options(joinedload(TvContent.category)).filter(TvContent.id == tv_id).first())


def delete_tv_content(db: Session, tv_id: int) -> None:
    item = db.query(TvContent).filter(TvContent.id == tv_id).first()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="TV icerigi bulunamadi")
    db.delete(item)
    db.commit()


# ── Radio Content Service ─────────────────────────────────────────────────────

def _serialize_radio(item: RadioContent) -> dict[str, Any]:
    return {
        "id": item.id,
        "title": item.title,
        "description": item.description,
        "category_id": item.category_id,
        "category_name": item.category.name if item.category else None,
        "logo_url": item.logo_url,
        "stream_url": item.stream_url,
        "is_public": item.is_public,
        "visual_url": item.visual_url,
        "visual_type": item.visual_type,
        "is_active": item.is_active,
        "server_id": item.server_id,
        "server_name": item.server.name if item.server else None,
        "started_at": item.started_at,
        "ffmpeg_pid": item.ffmpeg_pid,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


def list_radio_contents(db: Session, category_id: int | None = None) -> list[dict[str, Any]]:
    query = db.query(RadioContent).options(joinedload(RadioContent.category), joinedload(RadioContent.server)).order_by(RadioContent.created_at.desc())
    if category_id is not None:
        query = query.filter(RadioContent.category_id == category_id)
    return [_serialize_radio(item) for item in query.all()]


def create_radio_content(db: Session, payload: RadioContentCreate) -> dict[str, Any]:
    item = RadioContent(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return _serialize_radio(db.query(RadioContent).options(joinedload(RadioContent.category), joinedload(RadioContent.server)).filter(RadioContent.id == item.id).first())


def update_radio_content(db: Session, radio_id: int, payload: RadioContentUpdate) -> dict[str, Any]:
    item = db.query(RadioContent).options(joinedload(RadioContent.category), joinedload(RadioContent.server)).filter(RadioContent.id == radio_id).first()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Radyo icerigi bulunamadi")
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(item, key, value)
    db.add(item)
    db.commit()
    db.refresh(item)
    return _serialize_radio(db.query(RadioContent).options(joinedload(RadioContent.category), joinedload(RadioContent.server)).filter(RadioContent.id == radio_id).first())


def delete_radio_content(db: Session, radio_id: int) -> None:
    item = db.query(RadioContent).filter(RadioContent.id == radio_id).first()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Radyo icerigi bulunamadi")
    db.delete(item)
    db.commit()


# ── Music Track Service ───────────────────────────────────────────────────────

def _serialize_track(item: MusicTrack) -> dict[str, Any]:
    return {
        "id": item.id,
        "title": item.title,
        "artist": item.artist,
        "duration_seconds": item.duration_seconds,
        "file_path": item.file_path,
        "stream_url": item.stream_url,
        "category_id": item.category_id,
        "category_name": item.category.name if item.category else None,
        "cover_url": item.cover_url,
        "created_at": item.created_at,
    }


def list_music_tracks(db: Session, category_id: int | None = None) -> list[dict[str, Any]]:
    query = db.query(MusicTrack).options(joinedload(MusicTrack.category)).order_by(MusicTrack.created_at.desc())
    if category_id is not None:
        query = query.filter(MusicTrack.category_id == category_id)
    return [_serialize_track(item) for item in query.all()]


def create_music_track(db: Session, payload: MusicTrackCreate) -> dict[str, Any]:
    item = MusicTrack(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return _serialize_track(db.query(MusicTrack).options(joinedload(MusicTrack.category)).filter(MusicTrack.id == item.id).first())


def update_music_track(db: Session, track_id: int, payload: MusicTrackUpdate) -> dict[str, Any]:
    item = db.query(MusicTrack).options(joinedload(MusicTrack.category)).filter(MusicTrack.id == track_id).first()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Muzik parcasi bulunamadi")
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(item, key, value)
    db.add(item)
    db.commit()
    db.refresh(item)
    return _serialize_track(db.query(MusicTrack).options(joinedload(MusicTrack.category)).filter(MusicTrack.id == track_id).first())


def delete_music_track(db: Session, track_id: int) -> None:
    item = db.query(MusicTrack).filter(MusicTrack.id == track_id).first()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Muzik parcasi bulunamadi")
    db.delete(item)
    db.commit()


# ── Music Playlist Service ────────────────────────────────────────────────────

def _serialize_playlist_item(pi: MusicPlaylistItem) -> dict[str, Any]:
    track = pi.track
    return {
        "id": pi.id,
        "playlist_id": pi.playlist_id,
        "track_id": pi.track_id,
        "position": pi.position,
        "track": _serialize_track(track) if track else None,
    }


def _serialize_playlist(pl: MusicPlaylist) -> dict[str, Any]:
    return {
        "id": pl.id,
        "name": pl.name,
        "description": pl.description,
        "visual_url": pl.visual_url,
        "visual_type": pl.visual_type,
        "is_active": pl.is_active,
        "server_id": pl.server_id,
        "ffmpeg_pid": pl.ffmpeg_pid,
        "stream_url": pl.stream_url,
        "status": pl.status,
        "started_at": pl.started_at,
        "created_at": pl.created_at,
        "items": [_serialize_playlist_item(pi) for pi in pl.items],
    }


def _get_playlist(db: Session, playlist_id: int) -> MusicPlaylist:
    pl = (
        db.query(MusicPlaylist)
        .options(
            joinedload(MusicPlaylist.items).joinedload(MusicPlaylistItem.track).joinedload(MusicTrack.category)
        )
        .filter(MusicPlaylist.id == playlist_id)
        .first()
    )
    if pl is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Muzik playlist bulunamadi")
    return pl


def list_music_playlists(db: Session) -> list[dict[str, Any]]:
    playlists = (
        db.query(MusicPlaylist)
        .options(
            joinedload(MusicPlaylist.items).joinedload(MusicPlaylistItem.track).joinedload(MusicTrack.category)
        )
        .order_by(MusicPlaylist.created_at.desc())
        .all()
    )
    return [_serialize_playlist(pl) for pl in playlists]


def get_music_playlist(db: Session, playlist_id: int) -> dict[str, Any]:
    return _serialize_playlist(_get_playlist(db, playlist_id))


def create_music_playlist(db: Session, payload: MusicPlaylistCreate) -> dict[str, Any]:
    pl = MusicPlaylist(**payload.model_dump())
    db.add(pl)
    db.commit()
    db.refresh(pl)
    return _serialize_playlist(_get_playlist(db, pl.id))


def update_music_playlist(db: Session, playlist_id: int, payload: MusicPlaylistUpdate) -> dict[str, Any]:
    pl = db.query(MusicPlaylist).filter(MusicPlaylist.id == playlist_id).first()
    if pl is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Muzik playlist bulunamadi")
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(pl, key, value)
    db.add(pl)
    db.commit()
    db.refresh(pl)
    return _serialize_playlist(_get_playlist(db, playlist_id))


def delete_music_playlist(db: Session, playlist_id: int) -> None:
    pl = db.query(MusicPlaylist).filter(MusicPlaylist.id == playlist_id).first()
    if pl is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Muzik playlist bulunamadi")
    db.delete(pl)
    db.commit()


def add_playlist_item(db: Session, playlist_id: int, payload: MusicPlaylistItemCreate) -> dict[str, Any]:
    _get_playlist(db, playlist_id)
    track = db.query(MusicTrack).filter(MusicTrack.id == payload.track_id).first()
    if track is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Muzik parcasi bulunamadi")
    existing = db.query(MusicPlaylistItem).filter(
        MusicPlaylistItem.playlist_id == playlist_id,
        MusicPlaylistItem.track_id == payload.track_id,
    ).first()
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Bu parca zaten playlist icinde mevcut")
    if payload.position == 0:
        max_pos = db.query(func.max(MusicPlaylistItem.position)).filter(MusicPlaylistItem.playlist_id == playlist_id).scalar() or 0
        position = max_pos + 1
    else:
        position = payload.position
    pi = MusicPlaylistItem(playlist_id=playlist_id, track_id=payload.track_id, position=position)
    db.add(pi)
    db.commit()
    db.refresh(pi)
    pi_loaded = db.query(MusicPlaylistItem).options(joinedload(MusicPlaylistItem.track).joinedload(MusicTrack.category)).filter(MusicPlaylistItem.id == pi.id).first()
    return _serialize_playlist_item(pi_loaded)


def remove_playlist_item(db: Session, playlist_id: int, item_id: int) -> None:
    pi = db.query(MusicPlaylistItem).filter(
        MusicPlaylistItem.id == item_id,
        MusicPlaylistItem.playlist_id == playlist_id,
    ).first()
    if pi is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Playlist ögesi bulunamadi")
    db.delete(pi)
    db.commit()


def reorder_playlist_items(db: Session, playlist_id: int, ordered_ids: list[int]) -> dict[str, Any]:
    _get_playlist(db, playlist_id)
    items = db.query(MusicPlaylistItem).filter(
        MusicPlaylistItem.playlist_id == playlist_id,
        MusicPlaylistItem.id.in_(ordered_ids),
    ).all()
    item_map = {i.id: i for i in items}
    for pos, item_id in enumerate(ordered_ids, start=1):
        if item_id in item_map:
            item_map[item_id].position = pos
    db.commit()
    return _serialize_playlist(_get_playlist(db, playlist_id))
