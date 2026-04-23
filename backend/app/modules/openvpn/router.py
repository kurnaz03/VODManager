from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.modules.auth.router import get_current_user_id
from app.modules.openvpn import service
from app.modules.openvpn.schemas import (
    VpnClientCreate,
    VpnClientResponse,
    VpnServerConfigResponse,
    VpnServerConfigUpdate,
)

router = APIRouter(
    prefix="/openvpn",
    tags=["openvpn"],
    dependencies=[Depends(get_current_user_id)],
)


@router.post("/clients", response_model=VpnClientResponse, status_code=status.HTTP_201_CREATED)
def create_client(
    payload: VpnClientCreate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    return service.create_client(db, payload, user_id=user_id)


@router.get("/clients", response_model=list[VpnClientResponse])
def list_clients(db: Session = Depends(get_db)):
    return service.list_clients(db)


@router.get("/clients/{client_id}/download")
def download_client_ovpn(client_id: int, db: Session = Depends(get_db)):
    filename, content = service.get_client_ovpn_bytes(db, client_id)
    return Response(
        content=content,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.delete("/clients/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_client(client_id: int, db: Session = Depends(get_db)):
    service.delete_client(db, client_id)


@router.get("/server-config", response_model=VpnServerConfigResponse)
def get_server_config(db: Session = Depends(get_db)):
    return service.get_server_config(db)


@router.put("/server-config", response_model=VpnServerConfigResponse)
def update_server_config(payload: VpnServerConfigUpdate, db: Session = Depends(get_db)):
    return service.update_server_config(db, payload)
