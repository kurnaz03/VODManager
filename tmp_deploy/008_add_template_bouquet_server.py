"""add bouquet_id and server_id to info_screen_templates

Revision ID: 008_add_template_bouquet_server
Revises: 007_add_info_screen_bouquet_type
Create Date: 2026-05-16

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "008_add_template_bouquet_server"
down_revision: Union[str, None] = "007_add_info_screen_bouquet_type"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "info_screen_templates",
        sa.Column("bouquet_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "info_screen_templates",
        sa.Column("server_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_info_screen_templates_bouquet_id",
        "info_screen_templates",
        "bouquets",
        ["bouquet_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_info_screen_templates_server_id",
        "info_screen_templates",
        "servers",
        ["server_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_info_screen_templates_server_id", "info_screen_templates", type_="foreignkey")
    op.drop_constraint("fk_info_screen_templates_bouquet_id", "info_screen_templates", type_="foreignkey")
    op.drop_column("info_screen_templates", "server_id")
    op.drop_column("info_screen_templates", "bouquet_id")
