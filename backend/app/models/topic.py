import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Topic(Base):
    __tablename__ = "topics"
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_topics_user_name"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship("User", back_populates="topics")  # noqa: F821
    tasks: Mapped[list["Task"]] = relationship(  # noqa: F821
        "Task", secondary="task_topics", back_populates="topics"
    )
    recurring_templates: Mapped[list["RecurringTemplate"]] = relationship(  # noqa: F821
        "RecurringTemplate",
        secondary="recurring_template_topics",
        back_populates="topics",
    )
