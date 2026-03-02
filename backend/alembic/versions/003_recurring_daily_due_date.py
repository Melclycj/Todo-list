"""Add daily frequency and due_date to recurring_templates

Revision ID: 003
Revises: 002
Create Date: 2026-03-03

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add 'daily' to the recurringfrequency enum
    # IF NOT EXISTS prevents errors on repeated runs
    op.execute(sa.text("ALTER TYPE recurringfrequency ADD VALUE IF NOT EXISTS 'daily'"))

    # Add nullable due_date column to recurring_templates
    op.add_column(
        "recurring_templates",
        sa.Column("due_date", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("recurring_templates", "due_date")
    # Postgres does not support DROP VALUE from an enum; downgrade removes the column only.
    # To fully revert, drop and recreate the enum without 'daily'.
