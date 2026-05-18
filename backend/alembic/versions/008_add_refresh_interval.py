"""add refresh_interval to info_screen_templates

Revision ID: 008_add_refresh_interval
Revises: 007_add_info_screen_bouquet_type
Create Date: 2026-05-18

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "008_add_refresh_interval"
down_revision: Union[str, None] = "007_add_info_screen_bouquet_type"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "info_screen_templates",
        sa.Column("refresh_interval", sa.Integer(), nullable=False, server_default="30"),
    )


def downgrade() -> None:
    op.drop_column("info_screen_templates", "refresh_interval")
