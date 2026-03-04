"""
Unit tests for recurring_service.

Business rules tested:
- First instance created immediately on template creation
- next_run_at correctly advanced based on frequency (weekly=7d, fortnightly=14d, monthly=1 calendar month)
- Instance inherits title+date postfix from template
- Instance inherits topics from template
- Stopped templates (is_active=False) produce no new instances
- User ownership enforced on stop/update operations
"""
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

# Import all models first to ensure SQLAlchemy mapper is fully configured
import app.models  # noqa: F401
from app.models.recurring import RecurringFrequency, RecurringTemplate
from app.models.task import Task, TaskStatus
from app.services.recurring_service import (
    RecurringService,
    advance_next_run_at,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_template(
    frequency: RecurringFrequency = RecurringFrequency.WEEKLY,
    is_active: bool = True,
    next_run_at: datetime | None = None,
    user_id: uuid.UUID | None = None,
    title: str = "Weekly Review",
) -> RecurringTemplate:
    template = RecurringTemplate()
    template.id = uuid.uuid4()
    template.user_id = user_id or uuid.uuid4()
    template.title = title
    template.description = None
    template.frequency = frequency
    template.is_active = is_active
    template.next_run_at = next_run_at or datetime(2026, 2, 24, 4, 0, 0, tzinfo=timezone.utc)
    template.topics = []
    return template


# ---------------------------------------------------------------------------
# advance_next_run_at
# ---------------------------------------------------------------------------

class TestAdvanceNextRunAt:
    """Tests for the pure next_run_at advancement function."""

    def test_weekly_advances_by_7_days(self):
        from_dt = datetime(2026, 2, 24, 4, 0, 0, tzinfo=timezone.utc)
        result = advance_next_run_at(from_dt, RecurringFrequency.WEEKLY)
        assert result == datetime(2026, 3, 3, 4, 0, 0, tzinfo=timezone.utc)

    def test_fortnightly_advances_by_14_days(self):
        from_dt = datetime(2026, 2, 24, 4, 0, 0, tzinfo=timezone.utc)
        result = advance_next_run_at(from_dt, RecurringFrequency.FORTNIGHTLY)
        assert result == datetime(2026, 3, 10, 4, 0, 0, tzinfo=timezone.utc)

    def test_monthly_advances_by_one_calendar_month(self):
        from_dt = datetime(2026, 2, 24, 4, 0, 0, tzinfo=timezone.utc)
        result = advance_next_run_at(from_dt, RecurringFrequency.MONTHLY)
        assert result == datetime(2026, 3, 24, 4, 0, 0, tzinfo=timezone.utc)

    def test_monthly_from_jan_31_goes_to_feb_28(self):
        """Monthly from Jan 31 → Feb 28 (no Feb 31)."""
        from_dt = datetime(2026, 1, 31, 4, 0, 0, tzinfo=timezone.utc)
        result = advance_next_run_at(from_dt, RecurringFrequency.MONTHLY)
        # 2026 is not a leap year → Feb 28
        assert result == datetime(2026, 2, 28, 4, 0, 0, tzinfo=timezone.utc)

    def test_monthly_from_jan_31_leap_year_goes_to_feb_29(self):
        """Monthly from Jan 31 in a leap year → Feb 29."""
        from_dt = datetime(2028, 1, 31, 4, 0, 0, tzinfo=timezone.utc)
        result = advance_next_run_at(from_dt, RecurringFrequency.MONTHLY)
        assert result == datetime(2028, 2, 29, 4, 0, 0, tzinfo=timezone.utc)

    def test_monthly_from_dec_advances_to_jan_next_year(self):
        from_dt = datetime(2026, 12, 15, 4, 0, 0, tzinfo=timezone.utc)
        result = advance_next_run_at(from_dt, RecurringFrequency.MONTHLY)
        assert result == datetime(2027, 1, 15, 4, 0, 0, tzinfo=timezone.utc)

    def test_weekly_crosses_month_boundary(self):
        from_dt = datetime(2026, 2, 26, 4, 0, 0, tzinfo=timezone.utc)
        result = advance_next_run_at(from_dt, RecurringFrequency.WEEKLY)
        assert result == datetime(2026, 3, 5, 4, 0, 0, tzinfo=timezone.utc)


# ---------------------------------------------------------------------------
# RecurringService.create_template_with_first_instance
# ---------------------------------------------------------------------------

class TestRecurringServiceCreateTemplate:
    """Tests for creating a recurring template and its first instance."""

    def _make_service(self) -> tuple[RecurringService, AsyncMock, AsyncMock]:
        mock_template_repo = AsyncMock()
        mock_task_repo = AsyncMock()
        mock_topic_repo = AsyncMock()
        mock_topic_repo.get_by_ids_for_user.return_value = []

        service = RecurringService(
            template_repo=mock_template_repo,
            task_repo=mock_task_repo,
            topic_repo=mock_topic_repo,
        )
        return service, mock_template_repo, mock_task_repo

    @pytest.mark.asyncio
    async def test_create_template_creates_first_instance_immediately(self):
        """On creation, the first task instance is created right away."""
        service, mock_template_repo, mock_task_repo = self._make_service()
        user_id = uuid.uuid4()

        template = _make_template(user_id=user_id)
        mock_template_repo.create.return_value = template

        task = Task()
        task.id = uuid.uuid4()
        task.user_id = user_id
        task.title = "Weekly Review – 2026-02-24"
        task.status = TaskStatus.TODO
        task.archived = False
        task.topics = []
        mock_task_repo.create.return_value = task

        result_template, result_task = await service.create_template_with_first_instance(
            user_id=user_id,
            title="Weekly Review",
            frequency=RecurringFrequency.WEEKLY,
            now=datetime(2026, 2, 24, 4, 0, 0, tzinfo=timezone.utc),
        )

        # First instance must be created
        mock_task_repo.create.assert_called_once()
        # Template must be created
        mock_template_repo.create.assert_called_once()

    @pytest.mark.asyncio
    async def test_first_instance_has_date_postfix(self):
        """The first instance's title includes the date postfix."""
        service, mock_template_repo, mock_task_repo = self._make_service()
        user_id = uuid.uuid4()

        template = _make_template(user_id=user_id, title="Weekly Review")
        mock_template_repo.create.return_value = template

        task = Task()
        task.id = uuid.uuid4()
        task.title = "Weekly Review – 2026-02-24"
        task.user_id = user_id
        task.status = TaskStatus.TODO
        task.archived = False
        task.topics = []
        mock_task_repo.create.return_value = task

        _, first_task = await service.create_template_with_first_instance(
            user_id=user_id,
            title="Weekly Review",
            frequency=RecurringFrequency.WEEKLY,
            now=datetime(2026, 2, 24, 4, 0, 0, tzinfo=timezone.utc),
        )

        call_kwargs = mock_task_repo.create.call_args[1]
        assert "2026-02-24" in call_kwargs["title"]
        assert "Weekly Review" in call_kwargs["title"]

    @pytest.mark.asyncio
    async def test_create_template_with_empty_title_raises(self):
        """Empty title raises ValueError."""
        service, _, _ = self._make_service()
        with pytest.raises(ValueError, match="Title must not be empty"):
            await service.create_template_with_first_instance(
                user_id=uuid.uuid4(),
                title="",
                frequency=RecurringFrequency.WEEKLY,
                now=datetime(2026, 2, 24, 4, 0, 0, tzinfo=timezone.utc),
            )


# ---------------------------------------------------------------------------
# RecurringService.create_due_instances
# ---------------------------------------------------------------------------

class TestRecurringServiceCreateDueInstances:
    """Tests for the scheduler job: create instances for due templates."""

    def _make_service(self) -> tuple[RecurringService, AsyncMock, AsyncMock]:
        mock_template_repo = AsyncMock()
        mock_task_repo = AsyncMock()
        mock_topic_repo = AsyncMock()
        mock_topic_repo.get_by_ids_for_user.return_value = []

        service = RecurringService(
            template_repo=mock_template_repo,
            task_repo=mock_task_repo,
            topic_repo=mock_topic_repo,
        )
        return service, mock_template_repo, mock_task_repo

    @pytest.mark.asyncio
    async def test_creates_instance_for_due_templates(self):
        """Templates with next_run_at <= now get a new instance."""
        now = datetime(2026, 2, 24, 4, 0, 0, tzinfo=timezone.utc)

        template1 = _make_template(
            next_run_at=datetime(2026, 2, 24, 4, 0, 0, tzinfo=timezone.utc),
            is_active=True,
        )
        template2 = _make_template(
            next_run_at=datetime(2026, 2, 24, 3, 59, 0, tzinfo=timezone.utc),
            is_active=True,
        )

        service, mock_template_repo, mock_task_repo = self._make_service()
        mock_template_repo.get_due_templates.return_value = [template1, template2]

        task1 = Task()
        task1.id = uuid.uuid4()
        task1.title = "t1"
        task1.user_id = template1.user_id
        task1.status = TaskStatus.TODO
        task1.archived = False
        task1.topics = []

        task2 = Task()
        task2.id = uuid.uuid4()
        task2.title = "t2"
        task2.user_id = template2.user_id
        task2.status = TaskStatus.TODO
        task2.archived = False
        task2.topics = []

        mock_task_repo.create.side_effect = [task1, task2]
        mock_template_repo.update.return_value = None

        count = await service.create_due_instances(now=now)

        assert count == 2
        assert mock_task_repo.create.call_count == 2

    @pytest.mark.asyncio
    async def test_inactive_template_is_skipped(self):
        """Inactive templates do not produce instances."""
        now = datetime(2026, 2, 24, 4, 0, 0, tzinfo=timezone.utc)

        # get_due_templates should only return active templates
        service, mock_template_repo, mock_task_repo = self._make_service()
        mock_template_repo.get_due_templates.return_value = []

        count = await service.create_due_instances(now=now)

        assert count == 0
        mock_task_repo.create.assert_not_called()

    @pytest.mark.asyncio
    async def test_next_run_at_advanced_after_instance_creation(self):
        """After creating an instance, next_run_at is advanced by the frequency."""
        now = datetime(2026, 2, 24, 4, 0, 0, tzinfo=timezone.utc)
        template = _make_template(
            frequency=RecurringFrequency.WEEKLY,
            next_run_at=datetime(2026, 2, 24, 4, 0, 0, tzinfo=timezone.utc),
            is_active=True,
        )

        service, mock_template_repo, mock_task_repo = self._make_service()
        mock_template_repo.get_due_templates.return_value = [template]

        task = Task()
        task.id = uuid.uuid4()
        task.title = "t"
        task.user_id = template.user_id
        task.status = TaskStatus.TODO
        task.archived = False
        task.topics = []
        mock_task_repo.create.return_value = task

        await service.create_due_instances(now=now)

        # next_run_at should be advanced by 7 days
        update_kwargs = mock_template_repo.update.call_args[1]
        expected_next = datetime(2026, 3, 3, 4, 0, 0, tzinfo=timezone.utc)
        assert update_kwargs["next_run_at"] == expected_next

    @pytest.mark.asyncio
    async def test_instance_inherits_topics_from_template(self):
        """Recurring instance inherits topic IDs from the template."""
        now = datetime(2026, 2, 24, 4, 0, 0, tzinfo=timezone.utc)

        topic1 = MagicMock()
        topic1.id = uuid.uuid4()
        topic2 = MagicMock()
        topic2.id = uuid.uuid4()

        template = _make_template(is_active=True)
        template.topics = [topic1, topic2]

        service, mock_template_repo, mock_task_repo = self._make_service()
        mock_template_repo.get_due_templates.return_value = [template]

        task = Task()
        task.id = uuid.uuid4()
        task.title = "t"
        task.user_id = template.user_id
        task.status = TaskStatus.TODO
        task.archived = False
        task.topics = [topic1, topic2]
        mock_task_repo.create.return_value = task

        await service.create_due_instances(now=now)

        create_kwargs = mock_task_repo.create.call_args[1]
        # topic_ids should include both topic IDs
        assert set(create_kwargs["topic_ids"]) == {topic1.id, topic2.id}


# ---------------------------------------------------------------------------
# RecurringService.stop_template
# ---------------------------------------------------------------------------

class TestRecurringServiceStopTemplate:
    """Tests for stopping (deactivating) a recurring template."""

    def _make_service(self) -> tuple[RecurringService, AsyncMock]:
        mock_template_repo = AsyncMock()
        mock_task_repo = AsyncMock()
        mock_topic_repo = AsyncMock()
        service = RecurringService(
            template_repo=mock_template_repo,
            task_repo=mock_task_repo,
            topic_repo=mock_topic_repo,
        )
        return service, mock_template_repo

    @pytest.mark.asyncio
    async def test_stop_template_sets_is_active_false(self):
        """Stopping a template sets is_active=False."""
        template = _make_template(is_active=True)
        service, mock_template_repo = self._make_service()
        mock_template_repo.get_by_id.return_value = template
        mock_template_repo.update.return_value = template

        await service.stop_template(
            template_id=template.id, user_id=template.user_id
        )

        update_kwargs = mock_template_repo.update.call_args[1]
        assert update_kwargs["is_active"] is False

    @pytest.mark.asyncio
    async def test_stop_template_wrong_user_raises(self):
        """Non-owner cannot stop a template."""
        template = _make_template(is_active=True)
        service, mock_template_repo = self._make_service()
        mock_template_repo.get_by_id.return_value = template

        with pytest.raises(PermissionError, match="Not authorized"):
            await service.stop_template(
                template_id=template.id, user_id=uuid.uuid4()
            )

    @pytest.mark.asyncio
    async def test_stop_template_not_found_raises(self):
        """Raises LookupError when template not found."""
        service, mock_template_repo = self._make_service()
        mock_template_repo.get_by_id.return_value = None

        with pytest.raises(LookupError, match="Recurring template not found"):
            await service.stop_template(
                template_id=uuid.uuid4(), user_id=uuid.uuid4()
            )


class TestRecurringServiceDefaultNow:
    """Tests that cover the default now=datetime.now() branches."""

    @pytest.mark.asyncio
    async def test_create_due_instances_no_now_uses_utc(self):
        """create_due_instances uses current UTC time when now is not provided."""
        mock_template_repo = AsyncMock()
        mock_template_repo.get_due_templates.return_value = []
        service = RecurringService(
            template_repo=mock_template_repo,
            task_repo=AsyncMock(),
            topic_repo=AsyncMock(),
        )
        count = await service.create_due_instances()  # no now
        assert count == 0
        mock_template_repo.get_due_templates.assert_called_once()
        call_kwargs = mock_template_repo.get_due_templates.call_args[1]
        assert call_kwargs["now"].tzinfo is not None  # timezone-aware

    @pytest.mark.asyncio
    async def test_create_template_no_now_uses_utc(self):
        """create_template_with_first_instance uses UTC now when not provided."""
        mock_template_repo = AsyncMock()
        mock_task_repo = AsyncMock()
        mock_topic_repo = AsyncMock()

        template = _make_template()
        mock_template_repo.create.return_value = template

        task = MagicMock()
        task.id = uuid.uuid4()
        task.topics = []
        mock_task_repo.create.return_value = task

        service = RecurringService(
            template_repo=mock_template_repo,
            task_repo=mock_task_repo,
            topic_repo=mock_topic_repo,
        )
        _, _ = await service.create_template_with_first_instance(
            user_id=uuid.uuid4(),
            title="Test",
            frequency=RecurringFrequency.WEEKLY,
            # no now
        )
        mock_task_repo.create.assert_called_once()


class TestAdvanceNextRunAtInvalidFrequency:
    """Test that an unknown frequency raises ValueError."""

    def test_unknown_frequency_raises(self):
        from app.services.recurring_service import advance_next_run_at

        class FakeFreq:
            value = "unknown"

        from_dt = datetime(2026, 2, 24, 4, 0, 0, tzinfo=timezone.utc)
        with pytest.raises((ValueError, AttributeError)):
            advance_next_run_at(from_dt, FakeFreq())  # type: ignore


class TestRecurringServiceUpdateTemplate:
    """Tests for RecurringService.update_template."""

    def _make_service(self) -> tuple[RecurringService, AsyncMock]:
        mock_template_repo = AsyncMock()
        mock_task_repo = AsyncMock()
        mock_topic_repo = AsyncMock()
        service = RecurringService(
            template_repo=mock_template_repo,
            task_repo=mock_task_repo,
            topic_repo=mock_topic_repo,
        )
        return service, mock_template_repo

    @pytest.mark.asyncio
    async def test_update_template_changes_frequency(self):
        """Frequency change applies from the next instance onward."""
        template = _make_template(frequency=RecurringFrequency.WEEKLY)
        service, mock_template_repo = self._make_service()
        mock_template_repo.get_by_id.return_value = template
        mock_template_repo.update.return_value = template

        await service.update_template(
            template_id=template.id,
            user_id=template.user_id,
            frequency=RecurringFrequency.MONTHLY,
        )

        update_kwargs = mock_template_repo.update.call_args[1]
        assert update_kwargs["frequency"] == RecurringFrequency.MONTHLY

    @pytest.mark.asyncio
    async def test_update_template_not_found_raises(self):
        service, mock_template_repo = self._make_service()
        mock_template_repo.get_by_id.return_value = None

        with pytest.raises(LookupError, match="Recurring template not found"):
            await service.update_template(
                template_id=uuid.uuid4(),
                user_id=uuid.uuid4(),
                title="New Title",
            )

    @pytest.mark.asyncio
    async def test_update_template_wrong_user_raises(self):
        template = _make_template()
        service, mock_template_repo = self._make_service()
        mock_template_repo.get_by_id.return_value = template

        with pytest.raises(PermissionError, match="Not authorized"):
            await service.update_template(
                template_id=template.id,
                user_id=uuid.uuid4(),
                title="New Title",
            )

    @pytest.mark.asyncio
    async def test_update_template_empty_title_raises(self):
        template = _make_template()
        service, mock_template_repo = self._make_service()
        mock_template_repo.get_by_id.return_value = template

        with pytest.raises(ValueError, match="Title must not be empty"):
            await service.update_template(
                template_id=template.id,
                user_id=template.user_id,
                title="",
            )

    @pytest.mark.asyncio
    async def test_update_template_no_changes_still_calls_update(self):
        """Calling update with no field changes still invokes the repo."""
        template = _make_template()
        service, mock_template_repo = self._make_service()
        mock_template_repo.get_by_id.return_value = template
        mock_template_repo.update.return_value = template

        await service.update_template(
            template_id=template.id,
            user_id=template.user_id,
        )
        mock_template_repo.update.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_template_changes_title(self):
        template = _make_template(title="Old Title")
        service, mock_template_repo = self._make_service()
        mock_template_repo.get_by_id.return_value = template
        mock_template_repo.update.return_value = template

        await service.update_template(
            template_id=template.id,
            user_id=template.user_id,
            title="New Title",
        )
        update_kwargs = mock_template_repo.update.call_args[1]
        assert update_kwargs["title"] == "New Title"

    @pytest.mark.asyncio
    async def test_update_template_changes_topic_ids(self):
        template = _make_template()
        service, mock_template_repo = self._make_service()
        mock_template_repo.get_by_id.return_value = template
        mock_template_repo.update.return_value = template
        new_ids = [uuid.uuid4(), uuid.uuid4()]

        await service.update_template(
            template_id=template.id,
            user_id=template.user_id,
            topic_ids=new_ids,
        )
        update_kwargs = mock_template_repo.update.call_args[1]
        assert update_kwargs["topic_ids"] == new_ids

    @pytest.mark.asyncio
    async def test_update_template_changes_next_run_at(self):
        """Changing next_run_at shifts when the next instance is created."""
        template = _make_template()
        service, mock_template_repo = self._make_service()
        mock_template_repo.get_by_id.return_value = template
        mock_template_repo.update.return_value = template

        new_next_run_at = datetime(2026, 4, 5, 0, 0, 0, tzinfo=timezone.utc)
        await service.update_template(
            template_id=template.id,
            user_id=template.user_id,
            next_run_at=new_next_run_at,
        )
        update_kwargs = mock_template_repo.update.call_args[1]
        assert update_kwargs["next_run_at"] == new_next_run_at


# ---------------------------------------------------------------------------
# Daily frequency — advance_next_run_at
# ---------------------------------------------------------------------------

class TestAdvanceNextRunAtDaily:
    """Tests for the daily frequency in advance_next_run_at."""

    def test_daily_advances_by_1_day(self):
        from_dt = datetime(2026, 3, 3, 9, 0, 0, tzinfo=timezone.utc)
        result = advance_next_run_at(from_dt, RecurringFrequency.DAILY)
        assert result == datetime(2026, 3, 4, 9, 0, 0, tzinfo=timezone.utc)

    def test_daily_crosses_month_boundary(self):
        from_dt = datetime(2026, 3, 31, 9, 0, 0, tzinfo=timezone.utc)
        result = advance_next_run_at(from_dt, RecurringFrequency.DAILY)
        assert result == datetime(2026, 4, 1, 9, 0, 0, tzinfo=timezone.utc)


# ---------------------------------------------------------------------------
# Daily frequency — create_template_with_first_instance
# ---------------------------------------------------------------------------

class TestRecurringServiceCreateTemplateDaily:
    """Tests for daily recurring template creation."""

    def _make_service(self) -> tuple[RecurringService, AsyncMock, AsyncMock]:
        mock_template_repo = AsyncMock()
        mock_task_repo = AsyncMock()
        mock_topic_repo = AsyncMock()
        mock_topic_repo.get_by_ids_for_user.return_value = []
        service = RecurringService(
            template_repo=mock_template_repo,
            task_repo=mock_task_repo,
            topic_repo=mock_topic_repo,
        )
        return service, mock_template_repo, mock_task_repo

    @pytest.mark.asyncio
    async def test_daily_first_task_due_today(self):
        """Daily: first task's due_date equals the creation time (today)."""
        service, mock_template_repo, mock_task_repo = self._make_service()
        now = datetime(2026, 3, 3, 9, 0, 0, tzinfo=timezone.utc)

        template = _make_template(frequency=RecurringFrequency.DAILY)
        mock_template_repo.create.return_value = template

        task = Task()
        task.id = uuid.uuid4()
        task.user_id = template.user_id
        task.title = "Daily Standup – 2026-03-03"
        task.status = TaskStatus.TODO
        task.archived = False
        task.topics = []
        mock_task_repo.create.return_value = task

        await service.create_template_with_first_instance(
            user_id=template.user_id,
            title="Daily Standup",
            frequency=RecurringFrequency.DAILY,
            now=now,
        )

        task_kwargs = mock_task_repo.create.call_args[1]
        # Daily tasks get due_date = now (today)
        assert task_kwargs["due_date"] == now

    @pytest.mark.asyncio
    async def test_daily_template_has_no_due_date(self):
        """Daily: template.due_date is None (tasks are always due on creation day)."""
        service, mock_template_repo, mock_task_repo = self._make_service()
        now = datetime(2026, 3, 3, 9, 0, 0, tzinfo=timezone.utc)

        template = _make_template(frequency=RecurringFrequency.DAILY)
        mock_template_repo.create.return_value = template

        task = Task()
        task.id = uuid.uuid4()
        task.user_id = template.user_id
        task.title = "Daily Standup – 2026-03-03"
        task.status = TaskStatus.TODO
        task.archived = False
        task.topics = []
        mock_task_repo.create.return_value = task

        await service.create_template_with_first_instance(
            user_id=template.user_id,
            title="Daily Standup",
            frequency=RecurringFrequency.DAILY,
            now=now,
        )

        template_kwargs = mock_template_repo.create.call_args[1]
        assert template_kwargs["due_date"] is None

    @pytest.mark.asyncio
    async def test_daily_next_run_at_is_tomorrow(self):
        """Daily: template's next_run_at is set to now + 1 day."""
        service, mock_template_repo, mock_task_repo = self._make_service()
        now = datetime(2026, 3, 3, 9, 0, 0, tzinfo=timezone.utc)

        template = _make_template(frequency=RecurringFrequency.DAILY)
        mock_template_repo.create.return_value = template

        task = Task()
        task.id = uuid.uuid4()
        task.user_id = template.user_id
        task.title = "Daily Standup – 2026-03-03"
        task.status = TaskStatus.TODO
        task.archived = False
        task.topics = []
        mock_task_repo.create.return_value = task

        await service.create_template_with_first_instance(
            user_id=template.user_id,
            title="Daily Standup",
            frequency=RecurringFrequency.DAILY,
            now=now,
        )

        template_kwargs = mock_template_repo.create.call_args[1]
        expected_next = datetime(2026, 3, 4, 9, 0, 0, tzinfo=timezone.utc)
        assert template_kwargs["next_run_at"] == expected_next

    @pytest.mark.asyncio
    async def test_non_daily_with_due_date_uses_provided_due_date(self):
        """Weekly: first task gets the user-provided due_date."""
        service, mock_template_repo, mock_task_repo = self._make_service()
        now = datetime(2026, 3, 3, 9, 0, 0, tzinfo=timezone.utc)
        provided_due = datetime(2026, 3, 5, 0, 0, 0, tzinfo=timezone.utc)  # next Wednesday

        template = _make_template(frequency=RecurringFrequency.WEEKLY)
        mock_template_repo.create.return_value = template

        task = Task()
        task.id = uuid.uuid4()
        task.user_id = template.user_id
        task.title = "Weekly Review – 2026-03-03"
        task.status = TaskStatus.TODO
        task.archived = False
        task.topics = []
        mock_task_repo.create.return_value = task

        await service.create_template_with_first_instance(
            user_id=template.user_id,
            title="Weekly Review",
            frequency=RecurringFrequency.WEEKLY,
            due_date=provided_due,
            now=now,
        )

        task_kwargs = mock_task_repo.create.call_args[1]
        assert task_kwargs["due_date"] == provided_due

    @pytest.mark.asyncio
    async def test_non_daily_with_due_date_sets_next_run_at(self):
        """Weekly: template's next_run_at = due_date + 7 days."""
        service, mock_template_repo, mock_task_repo = self._make_service()
        now = datetime(2026, 3, 3, 9, 0, 0, tzinfo=timezone.utc)
        provided_due = datetime(2026, 3, 5, 0, 0, 0, tzinfo=timezone.utc)

        template = _make_template(frequency=RecurringFrequency.WEEKLY)
        mock_template_repo.create.return_value = template

        task = Task()
        task.id = uuid.uuid4()
        task.user_id = template.user_id
        task.title = "Weekly Review – 2026-03-03"
        task.status = TaskStatus.TODO
        task.archived = False
        task.topics = []
        mock_task_repo.create.return_value = task

        await service.create_template_with_first_instance(
            user_id=template.user_id,
            title="Weekly Review",
            frequency=RecurringFrequency.WEEKLY,
            due_date=provided_due,
            now=now,
        )

        template_kwargs = mock_template_repo.create.call_args[1]
        expected_next = datetime(2026, 3, 12, 0, 0, 0, tzinfo=timezone.utc)
        assert template_kwargs["next_run_at"] == expected_next


# ---------------------------------------------------------------------------
# create_due_instances — due_date propagation
# ---------------------------------------------------------------------------

class TestCreateDueInstancesDueDate:
    """Tests for due_date propagation in create_due_instances."""

    def _make_service(self) -> tuple[RecurringService, AsyncMock, AsyncMock]:
        mock_template_repo = AsyncMock()
        mock_task_repo = AsyncMock()
        mock_topic_repo = AsyncMock()
        service = RecurringService(
            template_repo=mock_template_repo,
            task_repo=mock_task_repo,
            topic_repo=mock_topic_repo,
        )
        return service, mock_template_repo, mock_task_repo

    @pytest.mark.asyncio
    async def test_daily_instance_due_today(self):
        """Scheduler-created daily tasks have due_date = now (today)."""
        now = datetime(2026, 3, 4, 9, 0, 0, tzinfo=timezone.utc)
        template = _make_template(
            frequency=RecurringFrequency.DAILY,
            next_run_at=now,
            is_active=True,
        )

        service, mock_template_repo, mock_task_repo = self._make_service()
        mock_template_repo.get_due_templates.return_value = [template]

        task = Task()
        task.id = uuid.uuid4()
        task.title = "Daily Standup – 2026-03-04"
        task.user_id = template.user_id
        task.status = TaskStatus.TODO
        task.archived = False
        task.topics = []
        mock_task_repo.create.return_value = task

        await service.create_due_instances(now=now)

        task_kwargs = mock_task_repo.create.call_args[1]
        assert task_kwargs["due_date"] == now

    @pytest.mark.asyncio
    async def test_non_daily_instance_due_at_next_run_at(self):
        """Scheduler-created weekly tasks have due_date = template.next_run_at."""
        scheduled = datetime(2026, 3, 12, 0, 0, 0, tzinfo=timezone.utc)
        now = datetime(2026, 3, 12, 9, 0, 0, tzinfo=timezone.utc)
        template = _make_template(
            frequency=RecurringFrequency.WEEKLY,
            next_run_at=scheduled,
            is_active=True,
        )

        service, mock_template_repo, mock_task_repo = self._make_service()
        mock_template_repo.get_due_templates.return_value = [template]

        task = Task()
        task.id = uuid.uuid4()
        task.title = "Weekly Review – 2026-03-12"
        task.user_id = template.user_id
        task.status = TaskStatus.TODO
        task.archived = False
        task.topics = []
        mock_task_repo.create.return_value = task

        await service.create_due_instances(now=now)

        task_kwargs = mock_task_repo.create.call_args[1]
        assert task_kwargs["due_date"] == scheduled
