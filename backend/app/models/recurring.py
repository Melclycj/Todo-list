import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    String,
    Table,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class RecurringFrequency(str, enum.Enum):
    WEEKLY = "weekly"
    FORTNIGHTLY = "fortnightly"
    MONTHLY = "monthly"


# Join table for recurring_template <-> topic many-to-many
recurring_template_topics = Table(
    "recurring_template_topics",
    Base.metadata,
    Column(
        "template_id",
        UUID(as_uuid=True),
        ForeignKey("recurring_templates.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "topic_id",
        UUID(as_uuid=True),
        ForeignKey("topics.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class RecurringTemplate(Base):
    __tablename__ = "recurring_templates"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    frequency: Mapped[RecurringFrequency] = mapped_column(
        Enum(RecurringFrequency, name="recurringfrequency", create_type=True),
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    next_run_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship("User", back_populates="recurring_templates")  # noqa: F821
    topics: Mapped[list["Topic"]] = relationship(  # noqa: F821
        "Topic",
        secondary="recurring_template_topics",
        back_populates="recurring_templates",
    )
    instances: Mapped[list["RecurringInstance"]] = relationship(
        "RecurringInstance", back_populates="template", cascade="all, delete-orphan"
    )


class RecurringInstance(Base):
    __tablename__ = "recurring_instances"

    template_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("recurring_templates.id", ondelete="CASCADE"),
        primary_key=True,
    )
    task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="CASCADE"),
        primary_key=True,
    )

    template: Mapped["RecurringTemplate"] = relationship(
        "RecurringTemplate", back_populates="instances"
    )
    task: Mapped["Task"] = relationship("Task", back_populates="recurring_instance")  # noqa: F821
