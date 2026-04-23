from sqlalchemy.orm import Session

from app.modules.content.models import MovieCategory, RadioCategory, SeriesCategory, TvCategory


DEFAULT_CATEGORIES: dict[str, list[str]] = {
    "movies": ["Aksiyon", "Komedi", "Dram", "Korku", "Bilim Kurgu", "Animasyon", "Belgesel"],
    "series": ["Aksiyon", "Komedi", "Dram", "Suç", "Bilim Kurgu", "Tarihi", "Belgesel"],
    "tv": ["Spor", "Haber", "Cocuk", "Muzik", "Sinema", "Belgesel", "Genel"],
    "radio": ["Pop", "Rock", "Klasik", "Haber", "Spor", "Jazz", "Arabesk"],
}

MODEL_MAP = {
    "movies": MovieCategory,
    "series": SeriesCategory,
    "tv": TvCategory,
    "radio": RadioCategory,
}


def ensure_default_categories(db: Session) -> None:
    for category_type, model in MODEL_MAP.items():
        if db.query(model).count() > 0:
            continue
        for index, name in enumerate(DEFAULT_CATEGORIES[category_type], start=1):
            db.add(
                model(
                    name=name,
                    description=f"{name} kategorisi",
                    icon="folder",
                    sort_order=index,
                    is_active=True,
                )
            )
    db.commit()
