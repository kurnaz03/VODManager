"""add_transcode_log_output

Revision ID: 002_add_transcode_log_output
Revises: 001_add_backups
Create Date: 2026-05-05

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "002_add_transcode_log_output"
down_revision: Union[str, None] = "001_add_backups"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "transcode_jobs",
        sa.Column("log_output", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("transcode_jobs", "log_output")
