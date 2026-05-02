"""add_backups_table

Revision ID: 001_add_backups
Revises:
Create Date: 2026-05-03

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "001_add_backups"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "backups",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
        ),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("file_path", sa.String(1000), nullable=True),
        sa.Column("file_size_bytes", sa.BigInteger(), nullable=True),
        sa.Column(
            "backup_type",
            sa.Enum("manual", "auto", "pre_restore", name="backuptype"),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum(
                "pending", "running", "completed", "failed", "restoring",
                name="backupstatus",
            ),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("task_id", sa.String(255), nullable=True),
        sa.Column(
            "progress_percent",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column(
            "restore_target_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("manifest_json", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_backups_id", "backups", ["id"])
    op.create_index(
        "ix_backups_filename", "backups", ["filename"], unique=True
    )
    op.create_index("ix_backups_backup_type", "backups", ["backup_type"])
    op.create_index("ix_backups_status", "backups", ["status"])
    op.create_index("ix_backups_task_id", "backups", ["task_id"])
    op.create_index("ix_backups_created_at", "backups", ["created_at"])
    op.create_index("ix_backups_created_by", "backups", ["created_by"])


def downgrade() -> None:
    op.drop_index("ix_backups_created_by", table_name="backups")
    op.drop_index("ix_backups_created_at", table_name="backups")
    op.drop_index("ix_backups_task_id", table_name="backups")
    op.drop_index("ix_backups_status", table_name="backups")
    op.drop_index("ix_backups_backup_type", table_name="backups")
    op.drop_index("ix_backups_filename", table_name="backups")
    op.drop_index("ix_backups_id", table_name="backups")
    op.drop_table("backups")
    op.execute("DROP TYPE IF EXISTS backuptype")
    op.execute("DROP TYPE IF EXISTS backupstatus")
