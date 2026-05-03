from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.modules.auth.router import get_current_user_id
from app.modules.dashboard import service
from app.modules.dashboard.schemas import CountryDetail, ViewerMapSummary

router = APIRouter(
    prefix="/dashboard",
    tags=["dashboard"],
    dependencies=[Depends(get_current_user_id)],
)


@router.get("/viewer-map", response_model=ViewerMapSummary)
def get_viewer_map(
    range: str = Query("now", pattern="^(now|24h|7d)$"),
    db: Session = Depends(get_db),
):
    """Dünya haritası için ülke bazlı izleyici sayıları."""
    return service.get_viewer_map_summary(db, range)


@router.get("/viewer-map/{country_code}", response_model=CountryDetail)
def get_country_detail(
    country_code: str,
    range: str = Query("now", pattern="^(now|24h|7d)$"),
    db: Session = Depends(get_db),
):
    """Belirli bir ülkedeki aktif bağlantıların detayları."""
    return service.get_country_detail(db, country_code.upper(), range)
