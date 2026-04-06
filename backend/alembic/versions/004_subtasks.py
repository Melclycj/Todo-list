"""Add subtasks table

Revision ID: 004
Revises: 003
Create Date: 2026-04-06

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Reuse the existing taskstatus enum — do NOT create it again.
    taskstatus = postgresql.ENUM("todo", "in_progress", "done", name="taskstatus", create_type=False)

    op.create_table(
        "subtasks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("task_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("status", taskstatus, nullable=False, server_default="todo"),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_subtasks_task_id", "subtasks", ["task_id"])


def downgrade() -> None:
    op.drop_index("ix_subtasks_task_id", table_name="subtasks")
    op.drop_table("subtasks")
