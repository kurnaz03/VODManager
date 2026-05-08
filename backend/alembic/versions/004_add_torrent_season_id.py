"""add_torrent_season_id

Revision ID: 004_add_torrent_season_id
Revises: 003_add_torrent_no_seed
Create Date: 2026-05-08

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "004_add_torrent_season_id"
down_revision: Union[str, None] = "003_add_torrent_no_seed"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "torrent_downloads",
        sa.Column("season_id", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("torrent_downloads", "season_id")
