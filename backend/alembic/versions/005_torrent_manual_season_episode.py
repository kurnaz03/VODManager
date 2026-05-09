"""torrent_manual_season_episode

Revision ID: 005_torrent_manual_season_episode
Revises: 004_add_torrent_season_id
Create Date: 2026-05-09

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "005_torrent_season_episode"
down_revision: Union[str, None] = "004_add_torrent_season_id"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("torrent_downloads", sa.Column("season_number", sa.Integer(), nullable=True))
    op.add_column("torrent_downloads", sa.Column("episode_number", sa.Integer(), nullable=True))
    op.execute(
        """
        UPDATE torrent_downloads AS td
        SET season_number = ss.season_number
        FROM series_seasons AS ss
        WHERE td.season_id = ss.id
        """
    )
    op.drop_column("torrent_downloads", "season_id")


def downgrade() -> None:
    op.add_column("torrent_downloads", sa.Column("season_id", sa.Integer(), nullable=True))
    op.execute(
        """
        UPDATE torrent_downloads AS td
        SET season_id = ss.id
        FROM series_seasons AS ss
        WHERE td.category_id = ss.series_id
          AND td.season_number = ss.season_number
        """
    )
    op.drop_column("torrent_downloads", "episode_number")
    op.drop_column("torrent_downloads", "season_number")