"""
Recurring task service — handles template creation, instance generation,
frequency advancement, and template lifecycle management.
"""
import uuid
from calendar import monthrange
from datetime import datetime, timedelta, timezone

from app.exceptions import AppError
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

    - daily:       +1 day
    - weekly:      +7 days
    - fortnightly: +14 days
    - monthly:     +1 calendar month (clamped to last day of month if needed)
    """
    if frequency == RecurringFrequency.DAILY:
        return from_dt + timedelta(days=1)

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

    raise AppError(f"Unknown frequency: {frequency}")


def reverse_next_run_at(
    next_run_at: datetime, frequency: RecurringFrequency
) -> datetime:
    """
    Derive the last scheduled date by reversing one frequency step.

    This is the inverse of advance_next_run_at — it computes the date from
    which next_run_at was originally advanced.
    """
    if frequency == RecurringFrequency.DAILY:
        return next_run_at - timedelta(days=1)

    if frequency == RecurringFrequency.WEEKLY:
        return next_run_at - timedelta(days=7)

    if frequency == RecurringFrequency.FORTNIGHTLY:
        return next_run_at - timedelta(days=14)

    if frequency == RecurringFrequency.MONTHLY:
        year = next_run_at.year
        month = next_run_at.month - 1
        if month < 1:
            month = 12
            year -= 1
        max_day = monthrange(year, month)[1]
        day = min(next_run_at.day, max_day)
        return next_run_at.replace(year=year, month=month, day=day)

    raise AppError(f"Unknown frequency: {frequency}")


# ---------------------------------------------------------------------------
# RecurringService
# ---------------------------------------------------------------------------

class RecurringService:
    """
    Orchestrates recurring template operations and scheduled instance creation.
    """

    def __init__(self, uow) -> None:
        self._uow = uow

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
        due_date: datetime | None = None,
        now: datetime | None = None,
    ) -> tuple[RecurringTemplate, Task]:
        """
        Create a recurring template and immediately spawn the first instance.

        The first instance's title is formatted as "<title> – YYYY-MM-DD".

        For daily frequency:
          - The first task's due_date is today (now).
          - Template's due_date is None (tasks are always due on the day created).
          - next_run_at = now + 1 day.

        For weekly/fortnightly/monthly:
          - The user-provided due_date (or now if not given) is used as the
            first task's due_date and the basis for next_run_at.
          - next_run_at = due_date + frequency.
        """
        if now is None:
            now = datetime.now(tz=timezone.utc)

        title = title.strip() if title else ""
        if not title:
            raise AppError("Title must not be empty")

        topic_ids = topic_ids or []

        if frequency == RecurringFrequency.DAILY:
            # Daily tasks are always due on the day they're created
            first_task_due = now
            template_due_date = None
            next_run_at = advance_next_run_at(now, frequency)
        else:
            # Use user-provided due_date or fall back to now
            effective_due = due_date or now
            first_task_due = effective_due
            template_due_date = effective_due
            next_run_at = advance_next_run_at(effective_due, frequency)

        # Create the template (flush only — no commit yet)
        template = await self._uow.templates.create(
            user_id=user_id,
            title=title,
            description=description,
            frequency=frequency,
            is_active=True,
            next_run_at=next_run_at,
            due_date=template_due_date,
            topic_ids=topic_ids,
        )

        # Create the first instance immediately (flush only)
        instance_title = build_instance_title(title, now)
        first_task = await self._uow.tasks.create(
            user_id=user_id,
            title=instance_title,
            description=description,
            due_date=first_task_due,
            status=TaskStatus.TODO,
            archived=False,
            topic_ids=topic_ids,
        )

        # Record the recurring_instance link (flush only)
        await self._uow.templates.link_instance(
            template_id=template.id, task_id=first_task.id
        )

        # ONE atomic commit — template + first task + link all persist together
        await self._uow.commit()

        return template, first_task

    # ------------------------------------------------------------------
    # Scheduler job: create due instances
    # ------------------------------------------------------------------

    async def create_due_instances(
        self, now: datetime | None = None
    ) -> int:
        """
        For each active recurring template where next_run_at <= now,
        create ALL overdue instances (catching up missed periods) and
        advance next_run_at past now.

        Due date logic:
          - daily:  due_date = the scheduled date (next_run_at for each period)
          - others: due_date = template.next_run_at (the scheduled date)

        Returns:
            Number of instances created.
        """
        if now is None:
            now = datetime.now(tz=timezone.utc)

        due_templates = await self._uow.templates.get_due_templates(now=now)
        count = 0

        for template in due_templates:
            current_run_at = template.next_run_at
            topic_ids = [t.id for t in (template.topics or [])]

            # Create instances for every overdue period until caught up
            while current_run_at <= now:
                task_due_date = current_run_at

                instance_title = build_instance_title(template.title, current_run_at)

                task = await self._uow.tasks.create(
                    user_id=template.user_id,
                    title=instance_title,
                    description=template.description,
                    due_date=task_due_date,
                    status=TaskStatus.TODO,
                    archived=False,
                    topic_ids=topic_ids,
                )

                await self._uow.templates.link_instance(
                    template_id=template.id, task_id=task.id
                )

                current_run_at = advance_next_run_at(current_run_at, template.frequency)
                count += 1

            # Advance next_run_at to the first future period
            await self._uow.templates.update(
                template_id=template.id,
                next_run_at=current_run_at,
            )

            # Commit per template — each template's catch-up is atomic
            await self._uow.commit()

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
        template = await self._uow.templates.get_by_id(template_id)
        if template is None:
            raise LookupError("Recurring template not found")
        if template.user_id != user_id:
            raise PermissionError("Not authorized")

        result = await self._uow.templates.update(
            template_id=template_id, is_active=False
        )
        await self._uow.commit()
        return result

    # ------------------------------------------------------------------
    # Delete template
    # ------------------------------------------------------------------

    async def delete_template(
        self, template_id: uuid.UUID, user_id: uuid.UUID
    ) -> None:
        """
        Permanently delete a recurring template.

        Instance links are removed but the spawned tasks themselves are kept.
        """
        template = await self._uow.templates.get_by_id(template_id)
        if template is None:
            raise LookupError("Recurring template not found")
        if template.user_id != user_id:
            raise PermissionError("Not authorized")

        await self._uow.templates.delete(template_id)
        await self._uow.commit()

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
        next_run_at: datetime | None = None,
        topic_ids: list[uuid.UUID] | None = None,
    ) -> RecurringTemplate:
        """
        Update a recurring template's fields.
        Frequency changes apply from the next instance onward.
        Changing next_run_at shifts when the next task instance will be created.
        """
        template = await self._uow.templates.get_by_id(template_id)
        if template is None:
            raise LookupError("Recurring template not found")
        if template.user_id != user_id:
            raise PermissionError("Not authorized")

        update_fields: dict = {}
        if title is not None:
            title = title.strip()
            if not title:
                raise AppError("Title must not be empty")
            update_fields["title"] = title
        if description is not None:
            update_fields["description"] = description
        if frequency is not None and frequency != template.frequency:
            update_fields["frequency"] = frequency
            # Recalculate next_run_at so the change applies from the next
            # instance onward.  Derive the last scheduled date by reversing
            # one old-frequency step, then advance by one new-frequency step.
            last_scheduled = reverse_next_run_at(template.next_run_at, template.frequency)
            update_fields["next_run_at"] = advance_next_run_at(last_scheduled, frequency)
        if next_run_at is not None:
            update_fields["next_run_at"] = next_run_at
        if topic_ids is not None:
            update_fields["topic_ids"] = topic_ids

        result = await self._uow.templates.update(
            template_id=template_id, **update_fields
        )
        await self._uow.commit()
        return result

    # ------------------------------------------------------------------
    # List templates
    # ------------------------------------------------------------------

    async def list_templates(self, user_id: uuid.UUID) -> list[RecurringTemplate]:
        """List all recurring templates for the given user."""
        return await self._uow.templates.list_for_user(user_id=user_id)
