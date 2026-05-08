"""add_torrent_no_seed

Revision ID: 003_add_torrent_no_seed
Revises: 002_add_transcode_log_output
Create Date: 2026-05-08

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "003_add_torrent_no_seed"
down_revision: Union[str, None] = "002_add_transcode_log_output"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "torrent_downloads",
        sa.Column("no_seed", sa.Boolean(), nullable=False, server_default="true"),
    )


def downgrade() -> None:
    op.drop_column("torrent_downloads", "no_seed")
