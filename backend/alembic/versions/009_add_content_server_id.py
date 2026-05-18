"""add server_id to movie_contents, series_contents, download_queue

Revision ID: 009_add_content_server_id
Revises: 008_add_template_bouquet_server
Create Date: 2026-05-18
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "009_add_content_server_id"
down_revision: Union[str, None] = "008_add_template_bouquet_server"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("movie_contents", sa.Column("server_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_movie_contents_server_id",
        "movie_contents",
        "servers",
        ["server_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.add_column("series_contents", sa.Column("server_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_series_contents_server_id",
        "series_contents",
        "servers",
        ["server_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.add_column("download_queue", sa.Column("server_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_download_queue_server_id",
        "download_queue",
        "servers",
        ["server_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_download_queue_server_id", "download_queue", type_="foreignkey")
    op.drop_column("download_queue", "server_id")
    op.drop_constraint("fk_series_contents_server_id", "series_contents", type_="foreignkey")
    op.drop_column("series_contents", "server_id")
    op.drop_constraint("fk_movie_contents_server_id", "movie_contents", type_="foreignkey")
    op.drop_column("movie_contents", "server_id")
