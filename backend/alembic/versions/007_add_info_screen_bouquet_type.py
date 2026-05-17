"""add info_screen to bouquet_item_type enum

Revision ID: 007_add_info_screen_bouquet_type
Revises: 006_add_info_screen_templates
Create Date: 2026-05-16

"""
from typing import Sequence, Union

from alembic import op

revision: str = "007_add_info_screen_bouquet_type"
down_revision: Union[str, None] = "006_add_info_screen_templates"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # PostgreSQL: ALTER TYPE ... ADD VALUE
    op.execute("ALTER TYPE bouquetitemtype ADD VALUE IF NOT EXISTS 'info_screen'")


def downgrade() -> None:
    # PostgreSQL enum değeri kaldırmak mümkün değil standart yolla;
    # Bu migration geri alınamaz (downgrade no-op).
    pass
