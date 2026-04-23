from fastapi import APIRouter, BackgroundTasks, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db, SessionLocal
from app.modules.auth.router import get_current_user_id
from app.modules.servers import service
from app.modules.servers.models import ServerStatus
from app.modules.servers.schemas import (
    ServerCheckPayload,
    ServerCheckResponse,
    ServerConnectionPayload,
    ServerCreate,
    ServerInstallStatusResponse,
    ServerMetricResponse,
    ServerResponse,
    ServerUpdate,
)

router = APIRouter(prefix="/servers", tags=["servers"], dependencies=[Depends(get_current_user_id)])


def _run_installation_job(server_id: int) -> None:
    db = SessionLocal()
    try:
        service.run_installation(db, server_id)
    finally:
        db.close()


@router.get("", response_model=list[ServerResponse])
def list_servers(db: Session = Depends(get_db)):
    return service.list_servers(db)


@router.post("/check", response_model=ServerCheckResponse)
def test_connection(payload: ServerCheckPayload):
    return service.test_connection_payload(payload)


@router.post("", response_model=ServerResponse, status_code=status.HTTP_201_CREATED)
def create_server(payload: ServerCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    server = service.create_server(db, payload)
    # SSH baglantisi basarili olduysa otomatik kurulum baslatilir
    if server.status == ServerStatus.installing:
        background_tasks.add_task(_run_installation_job, server.id)
    return server


@router.get("/{server_id}", response_model=ServerResponse)
def get_server(server_id: int, db: Session = Depends(get_db)):
    return service.get_server(db, server_id)


@router.put("/{server_id}", response_model=ServerResponse)
def update_server(server_id: int, payload: ServerUpdate, db: Session = Depends(get_db)):
    return service.update_server(db, server_id, payload)


@router.delete("/{server_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_server(server_id: int, db: Session = Depends(get_db)):
    service.delete_server(db, server_id)


@router.get("/{server_id}/metrics", response_model=ServerMetricResponse | None)
def latest_metrics(server_id: int, db: Session = Depends(get_db)):
    return service.get_latest_metrics(db, server_id)


@router.get("/{server_id}/metrics/history", response_model=list[ServerMetricResponse])
def metrics_history(server_id: int, db: Session = Depends(get_db)):
    return service.get_metric_history(db, server_id)


@router.post("/{server_id}/install")
def install_server(server_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    service.start_installation(db, server_id)
    background_tasks.add_task(_run_installation_job, server_id)
    return {"message": "Kurulum baslatildi"}


@router.get("/{server_id}/install/status", response_model=ServerInstallStatusResponse)
def install_status(server_id: int, db: Session = Depends(get_db)):
    return service.get_install_status(db, server_id)


@router.post("/{server_id}/check", response_model=ServerCheckResponse)
def check_server(server_id: int, db: Session = Depends(get_db)):
    return service.check_server(db, server_id)


@router.post("/{server_id}/restart")
def restart_server(server_id: int, db: Session = Depends(get_db)):
    return service.restart_server(db, server_id)