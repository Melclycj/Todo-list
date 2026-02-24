"""
Recurring task service — handles template creation, instance generation,
frequency advancement, and template lifecycle management.
"""
import uuid
from calendar import monthrange
from datetime import datetime, timedelta, timezone

from app.models.recurring import RecurringFrequency, RecurringTemplate
from app.models.task import Task, TaskStatus
from app.services.task_service import build_instance_title


# ---------------------------------------------------------------------------
# Pure helper: advance next_run_at
# ---------------------------------------------------------------------------

def advance_next_run_at(
    from_dt: datetime, frequency: RecurringFrequency
) -> datetime:
    """
    Return the next scheduled run time after from_dt for the given frequency.

    - weekly:      +7 days
    - fortnightly: +14 days
    - monthly:     +1 calendar month (clamped to last day of month if needed)
    """
    if frequency == RecurringFrequency.WEEKLY:
        return from_dt + timedelta(days=7)

    if frequency == RecurringFrequency.FORTNIGHTLY:
        return from_dt + timedelta(days=14)

    if frequency == RecurringFrequency.MONTHLY:
        # Add one month, clamping to the last valid day of that month
        year = from_dt.year
        month = from_dt.month + 1
        if month > 12:
            month = 1
            year += 1
        # Clamp day to the last day of the target month
        max_day = monthrange(year, month)[1]
        day = min(from_dt.day, max_day)
        return from_dt.replace(year=year, month=month, day=day)

    raise ValueError(f"Unknown frequency: {frequency}")


# ---------------------------------------------------------------------------
# RecurringService
# ---------------------------------------------------------------------------

class RecurringService:
    """
    Orchestrates recurring template operations and scheduled instance creation.
    """

    def __init__(self, template_repo, task_repo, topic_repo=None) -> None:
        self._template_repo = template_repo
        self._task_repo = task_repo
        self._topic_repo = topic_repo

    # ------------------------------------------------------------------
    # Create template + first instance
    # ------------------------------------------------------------------

    async def create_template_with_first_instance(
        self,
        user_id: uuid.UUID,
        title: str,
        frequency: RecurringFrequency,
        description: str | None = None,
        topic_ids: list[uuid.UUID] | None = None,
        now: datetime | None = None,
    ) -> tuple[RecurringTemplate, Task]:
        """
        Create a recurring template and immediately spawn the first instance.

        The first instance's title is formatted as "<title> – YYYY-MM-DD".
        next_run_at for the template is set to `now + frequency`.
        """
        if now is None:
            now = datetime.now(tz=timezone.utc)

        title = title.strip() if title else ""
        if not title:
            raise ValueError("Title must not be empty")

        topic_ids = topic_ids or []

        # Calculate next_run_at (first instance is created now, next at +frequency)
        next_run_at = advance_next_run_at(now, frequency)

        # Create the template
        template = await self._template_repo.create(
            user_id=user_id,
            title=title,
            description=description,
            frequency=frequency,
            is_active=True,
            next_run_at=next_run_at,
            topic_ids=topic_ids,
        )

        # Create the first instance immediately
        instance_title = build_instance_title(title, now)
        first_task = await self._task_repo.create(
            user_id=user_id,
            title=instance_title,
            description=description,
            due_date=None,
            status=TaskStatus.TODO,
            archived=False,
            topic_ids=topic_ids,
        )

        # Record the recurring_instance link
        await self._template_repo.link_instance(
            template_id=template.id, task_id=first_task.id
        )

        return template, first_task

    # ------------------------------------------------------------------
    # Scheduler job: create due instances
    # ------------------------------------------------------------------

    async def create_due_instances(
        self, now: datetime | None = None
    ) -> int:
        """
        For each active recurring template where next_run_at <= now:
          1. Create a new task instance.
          2. Advance next_run_at by the frequency.

        Returns:
            Number of instances created.
        """
        if now is None:
            now = datetime.now(tz=timezone.utc)

        due_templates = await self._template_repo.get_due_templates(now=now)
        count = 0

        for template in due_templates:
            # Build the instance
            instance_title = build_instance_title(template.title, now)
            topic_ids = [t.id for t in (template.topics or [])]

            task = await self._task_repo.create(
                user_id=template.user_id,
                title=instance_title,
                description=template.description,
                due_date=None,
                status=TaskStatus.TODO,
                archived=False,
                topic_ids=topic_ids,
            )

            # Link as recurring instance
            await self._template_repo.link_instance(
                template_id=template.id, task_id=task.id
            )

            # Advance next_run_at
            new_next_run_at = advance_next_run_at(template.next_run_at, template.frequency)
            await self._template_repo.update(
                template_id=template.id,
                next_run_at=new_next_run_at,
            )

            count += 1

        return count

    # ------------------------------------------------------------------
    # Stop template
    # ------------------------------------------------------------------

    async def stop_template(
        self, template_id: uuid.UUID, user_id: uuid.UUID
    ) -> RecurringTemplate:
        """
        Permanently stop a recurring template (is_active=False).

        Existing instances are unaffected.
        """
        template = await self._template_repo.get_by_id(template_id)
        if template is None:
            raise LookupError("Recurring template not found")
        if template.user_id != user_id:
            raise PermissionError("Not authorized")

        return await self._template_repo.update(
            template_id=template_id, is_active=False
        )

    # ------------------------------------------------------------------
    # Update template
    # ------------------------------------------------------------------

    async def update_template(
        self,
        template_id: uuid.UUID,
        user_id: uuid.UUID,
        title: str | None = None,
        description: str | None = None,
        frequency: RecurringFrequency | None = None,
        topic_ids: list[uuid.UUID] | None = None,
    ) -> RecurringTemplate:
        """
        Update a recurring template's fields.
        Frequency changes apply from the next instance onward.
        """
        template = await self._template_repo.get_by_id(template_id)
        if template is None:
            raise LookupError("Recurring template not found")
        if template.user_id != user_id:
            raise PermissionError("Not authorized")

        update_fields: dict = {}
        if title is not None:
            title = title.strip()
            if not title:
                raise ValueError("Title must not be empty")
            update_fields["title"] = title
        if description is not None:
            update_fields["description"] = description
        if frequency is not None:
            update_fields["frequency"] = frequency
        if topic_ids is not None:
            update_fields["topic_ids"] = topic_ids

        return await self._template_repo.update(
            template_id=template_id, **update_fields
        )
