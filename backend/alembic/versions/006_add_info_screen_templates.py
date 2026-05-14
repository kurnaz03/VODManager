"""add info_screen_templates table

Revision ID: 006_add_info_screen_templates
Revises: 005_torrent_manual_season_episode
Create Date: 2026-05-15

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "006_add_info_screen_templates"
down_revision: Union[str, None] = "005_torrent_manual_season_episode"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "info_screen_templates",
        sa.Column("id", sa.Integer(), nullable=False, primary_key=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("is_default", sa.Boolean(), nullable=False, default=False, server_default="false"),
        sa.Column("bg_image_url", sa.String(length=1000), nullable=True),
        sa.Column("title_text", sa.String(length=100), nullable=False, default="ŞU ANDA YAYINDA OLANLAR", server_default="ŞU ANDA YAYINDA OLANLAR"),
        sa.Column("subtitle_text", sa.String(length=100), nullable=True),
        sa.Column("primary_color", sa.String(length=20), nullable=False, default="#D4A843", server_default="#D4A843"),
        sa.Column("bg_overlay_opacity", sa.Integer(), nullable=False, default=70, server_default="70"),
        sa.Column("font_family", sa.String(length=50), nullable=False, default="serif", server_default="serif"),
        sa.Column("layout", sa.String(length=30), nullable=False, default="cinema", server_default="cinema"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_info_screen_templates_id", "info_screen_templates", ["id"], unique=False)


def downgrade() -> None:
    op.drop_table("info_screen_templates")
