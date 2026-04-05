"""
Unit tests for reminder_service.

Business rules (FR-07) — evaluated top-to-bottom, first match applies:

1. More than half of today's tasks NOT complete  AND after 1am
   → "What's done is done. Go to sleep and try harder tomorrow."

2. ALL of today's tasks complete  AND after 6pm
   → "Good job! Now it's time to help the future you!"

3. ALL of today's tasks complete  AND before 6pm
   → "Good job! Time to take a rest and enjoy your time."

4. More than half of today's tasks complete  AND after 6pm
   → "Need to hurry up!"

5. More than half of today's tasks complete  AND before 6pm
   → "Good progress, keep it up!"

6. Half or fewer of today's tasks complete  AND after 6pm
   → "The day is ending. Manage wisely if you missed the deadline."

7. Half or fewer of today's tasks complete  AND before 6pm
   → "Good day. Let's keep going!"

"complete" means status == done.
"today's tasks" = tasks due within the current 4am–4am window.
"""
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.reminder_service import ReminderService, compute_reminder_message


class TestComputeReminderMessage:
    """Tests for the pure compute_reminder_message function."""

    # ------------------------------------------------------------------
    # Rule 1: >50% NOT done AND after 1am
    # ------------------------------------------------------------------

    def test_rule1_majority_not_done_after_1am(self):
        """More than half not done, after 1am → sleep message."""
        # 1 done out of 3 → 33% done → majority NOT done
        # Time: 2am (after 1am)
        message = compute_reminder_message(
            total_today=3,
            done_today=1,
            current_hour=2,
        )
        assert message == "What's done is done. Go to sleep and try harder tomorrow."

    def test_rule1_zero_done_after_1am(self):
        """0 done out of 5 → 0% done, after 1am → sleep message."""
        message = compute_reminder_message(
            total_today=5,
            done_today=0,
            current_hour=1,
        )
        assert message == "What's done is done. Go to sleep and try harder tomorrow."

    def test_rule1_exactly_1am_triggers(self):
        """Exactly 1am counts as 'after 1am' for rule 1."""
        message = compute_reminder_message(
            total_today=4,
            done_today=1,
            current_hour=1,
        )
        assert message == "What's done is done. Go to sleep and try harder tomorrow."

    def test_rule1_does_not_trigger_at_midnight(self):
        """Rule 1 does NOT apply before 1am (e.g. midnight)."""
        # 1 done out of 3, at midnight → not rule 1
        message = compute_reminder_message(
            total_today=3,
            done_today=1,
            current_hour=0,
        )
        # Should fall through to rule 6 (half or fewer, before 6pm in 4am boundary)
        # Hour 0 (midnight) is AFTER 6pm in calendar terms but within day boundary
        # Midnight (0) is after 6pm (18), so rule 6 applies
        assert message == "The day is ending. Manage wisely if you missed the deadline."

    def test_rule1_does_not_trigger_when_majority_done(self):
        """Rule 1 requires majority NOT done; if majority done, skip to rule 4."""
        # 4 done out of 5 → 80% done → majority done → rule 1 skipped
        message = compute_reminder_message(
            total_today=5,
            done_today=4,
            current_hour=2,
        )
        # After 1am, majority done → rule 4 (more than half done, after 6pm)
        # But hour 2 is "after 6pm" in 4am-boundary terms since it's past midnight
        assert message == "Need to hurry up!"

    # ------------------------------------------------------------------
    # Rule 2: ALL done AND after 6pm
    # ------------------------------------------------------------------

    def test_rule2_all_done_after_6pm(self):
        """All tasks done, after 6pm → future-you message."""
        message = compute_reminder_message(
            total_today=4,
            done_today=4,
            current_hour=19,
        )
        assert message == "Good job! Now it's time to help the future you!"

    def test_rule2_all_done_at_exactly_6pm(self):
        """Exactly 6pm counts as 'after 6pm'."""
        message = compute_reminder_message(
            total_today=2,
            done_today=2,
            current_hour=18,
        )
        assert message == "Good job! Now it's time to help the future you!"

    def test_rule2_all_done_at_midnight(self):
        """Midnight (0) is past 6pm in calendar terms — all done → rule 2."""
        message = compute_reminder_message(
            total_today=3,
            done_today=3,
            current_hour=0,
        )
        assert message == "Good job! Now it's time to help the future you!"

    def test_rule2_all_done_at_3am(self):
        """3am is past 6pm in calendar terms — all done → rule 2."""
        message = compute_reminder_message(
            total_today=1,
            done_today=1,
            current_hour=3,
        )
        assert message == "Good job! Now it's time to help the future you!"

    # ------------------------------------------------------------------
    # Rule 3: ALL done AND before 6pm
    # ------------------------------------------------------------------

    def test_rule3_all_done_before_6pm(self):
        """All tasks done, before 6pm → rest message."""
        message = compute_reminder_message(
            total_today=3,
            done_today=3,
            current_hour=14,
        )
        assert message == "Good job! Time to take a rest and enjoy your time."

    def test_rule3_all_done_at_noon(self):
        """Noon (12) is before 6pm → rest message."""
        message = compute_reminder_message(
            total_today=5,
            done_today=5,
            current_hour=12,
        )
        assert message == "Good job! Time to take a rest and enjoy your time."

    def test_rule3_all_done_at_5am(self):
        """5am is before 6pm → rest message when all done."""
        message = compute_reminder_message(
            total_today=2,
            done_today=2,
            current_hour=5,
        )
        assert message == "Good job! Time to take a rest and enjoy your time."

    def test_rule3_at_4am_start_of_day(self):
        """4am — start of day boundary — all done → before 6pm → rule 3."""
        message = compute_reminder_message(
            total_today=2,
            done_today=2,
            current_hour=4,
        )
        assert message == "Good job! Time to take a rest and enjoy your time."

    # ------------------------------------------------------------------
    # Rule 4: more than half done AND after 6pm
    # ------------------------------------------------------------------

    def test_rule4_majority_done_after_6pm(self):
        """More than half done, after 6pm → hurry up message."""
        message = compute_reminder_message(
            total_today=4,
            done_today=3,
            current_hour=20,
        )
        assert message == "Need to hurry up!"

    def test_rule4_exactly_half_plus_one_after_6pm(self):
        """Exactly half+1 done out of 4 total (75%) after 6pm → rule 4."""
        message = compute_reminder_message(
            total_today=4,
            done_today=3,
            current_hour=22,
        )
        assert message == "Need to hurry up!"

    # ------------------------------------------------------------------
    # Rule 5: more than half done AND before 6pm
    # ------------------------------------------------------------------

    def test_rule5_majority_done_before_6pm(self):
        """More than half done, before 6pm → keep it up message."""
        message = compute_reminder_message(
            total_today=4,
            done_today=3,
            current_hour=10,
        )
        assert message == "Good progress, keep it up!"

    def test_rule5_at_5pm(self):
        """5pm (17) is before 6pm → keep it up when majority done."""
        message = compute_reminder_message(
            total_today=5,
            done_today=4,
            current_hour=17,
        )
        assert message == "Good progress, keep it up!"

    # ------------------------------------------------------------------
    # Rule 6: half or fewer done AND after 6pm
    # ------------------------------------------------------------------

    def test_rule6_half_or_fewer_done_after_6pm(self):
        """Exactly half done, after 6pm → day ending message."""
        message = compute_reminder_message(
            total_today=4,
            done_today=2,
            current_hour=20,
        )
        assert message == "The day is ending. Manage wisely if you missed the deadline."

    def test_rule6_zero_done_after_6pm_before_1am(self):
        """0 done out of 3, at 7pm → rule 6 (after 6pm, before 1am)."""
        message = compute_reminder_message(
            total_today=3,
            done_today=0,
            current_hour=19,
        )
        assert message == "The day is ending. Manage wisely if you missed the deadline."

    def test_rule6_one_third_done_at_11pm(self):
        """1 out of 3 done at 11pm → exactly 1/3 (33%) → half or fewer → rule 6."""
        message = compute_reminder_message(
            total_today=3,
            done_today=1,
            current_hour=23,
        )
        assert message == "The day is ending. Manage wisely if you missed the deadline."

    # ------------------------------------------------------------------
    # Rule 7: half or fewer done AND before 6pm
    # ------------------------------------------------------------------

    def test_rule7_half_or_fewer_done_before_6pm(self):
        """Exactly half done, before 6pm → good day message."""
        message = compute_reminder_message(
            total_today=4,
            done_today=2,
            current_hour=9,
        )
        assert message == "Good day. Let's keep going!"

    def test_rule7_zero_done_morning(self):
        """0 done at 8am → half or fewer, before 6pm → rule 7."""
        message = compute_reminder_message(
            total_today=5,
            done_today=0,
            current_hour=8,
        )
        assert message == "Good day. Let's keep going!"

    def test_rule7_zero_tasks_before_6pm(self):
        """0 total tasks, 0 done at 10am → all done (vacuously true) → rule 3."""
        # Edge case: 0 tasks → all are complete (vacuously)
        # 0/0 = 100% done → all done, before 6pm → rule 3
        message = compute_reminder_message(
            total_today=0,
            done_today=0,
            current_hour=10,
        )
        assert message == "Good job! Time to take a rest and enjoy your time."

    def test_rule7_zero_tasks_after_6pm(self):
        """0 total tasks at 8pm → all done (vacuously) → rule 2."""
        message = compute_reminder_message(
            total_today=0,
            done_today=0,
            current_hour=20,
        )
        assert message == "Good job! Now it's time to help the future you!"

    # ------------------------------------------------------------------
    # Boundary: exactly half done — NOT "more than half"
    # ------------------------------------------------------------------

    def test_exactly_half_is_not_majority(self):
        """2 done out of 4 = exactly 50% = NOT more than half → rule 6 or 7."""
        # after 6pm → rule 6
        message = compute_reminder_message(
            total_today=4,
            done_today=2,
            current_hour=21,
        )
        assert message == "The day is ending. Manage wisely if you missed the deadline."

        # before 6pm → rule 7
        message2 = compute_reminder_message(
            total_today=4,
            done_today=2,
            current_hour=11,
        )
        assert message2 == "Good day. Let's keep going!"

    def test_one_more_than_half_is_majority(self):
        """3 done out of 4 = 75% = more than half → rule 4 or 5."""
        # after 6pm → rule 4
        message = compute_reminder_message(
            total_today=4,
            done_today=3,
            current_hour=21,
        )
        assert message == "Need to hurry up!"

        # before 6pm → rule 5
        message2 = compute_reminder_message(
            total_today=4,
            done_today=3,
            current_hour=11,
        )
        assert message2 == "Good progress, keep it up!"

    # ------------------------------------------------------------------
    # After-6pm detection: hours 18-23 and 0-3 (all after 6pm in day boundary)
    # "before 6pm" = hours 4-17
    # ------------------------------------------------------------------

    def test_hour_17_is_before_6pm(self):
        """5pm (hour 17) is before 6pm → rules 3/5/7 apply."""
        message = compute_reminder_message(
            total_today=3,
            done_today=1,
            current_hour=17,
        )
        assert message == "Good day. Let's keep going!"

    def test_hour_18_is_after_6pm(self):
        """6pm (hour 18) is after 6pm → rules 2/4/6 apply."""
        message = compute_reminder_message(
            total_today=3,
            done_today=1,
            current_hour=18,
        )
        assert message == "The day is ending. Manage wisely if you missed the deadline."


class TestGetCurrentDayBoundary:
    """Tests for the 4am–4am day boundary helper."""

    def test_day_starts_at_4am(self):
        """Hour 4 should be within today's window."""
        from app.services.reminder_service import get_day_window

        # 2026-02-24 04:00 UTC → day start = 2026-02-24 04:00, end = 2026-02-25 04:00
        dt = datetime(2026, 2, 24, 4, 0, 0, tzinfo=timezone.utc)
        start, end = get_day_window(dt)
        assert start == datetime(2026, 2, 24, 4, 0, 0, tzinfo=timezone.utc)
        assert end == datetime(2026, 2, 25, 4, 0, 0, tzinfo=timezone.utc)

    def test_3am_belongs_to_previous_day_window(self):
        """3:59 AM belongs to the PREVIOUS day's 4am window."""
        from app.services.reminder_service import get_day_window

        # 2026-02-24 03:59 → still in 2026-02-23 04:00 to 2026-02-24 04:00 window
        dt = datetime(2026, 2, 24, 3, 59, 0, tzinfo=timezone.utc)
        start, end = get_day_window(dt)
        assert start == datetime(2026, 2, 23, 4, 0, 0, tzinfo=timezone.utc)
        assert end == datetime(2026, 2, 24, 4, 0, 0, tzinfo=timezone.utc)

    def test_midnight_belongs_to_previous_day_window(self):
        """Midnight belongs to the previous day's 4am window."""
        from app.services.reminder_service import get_day_window

        dt = datetime(2026, 2, 24, 0, 0, 0, tzinfo=timezone.utc)
        start, end = get_day_window(dt)
        assert start == datetime(2026, 2, 23, 4, 0, 0, tzinfo=timezone.utc)
        assert end == datetime(2026, 2, 24, 4, 0, 0, tzinfo=timezone.utc)

    def test_exactly_at_4am_boundary(self):
        """Exactly 4:00:00 AM starts a new window."""
        from app.services.reminder_service import get_day_window

        dt = datetime(2026, 2, 24, 4, 0, 0, tzinfo=timezone.utc)
        start, end = get_day_window(dt)
        assert start == datetime(2026, 2, 24, 4, 0, 0, tzinfo=timezone.utc)

    def test_noon_belongs_to_today_window(self):
        """Noon (12:00) is within today's window."""
        from app.services.reminder_service import get_day_window

        dt = datetime(2026, 2, 24, 12, 0, 0, tzinfo=timezone.utc)
        start, end = get_day_window(dt)
        assert start == datetime(2026, 2, 24, 4, 0, 0, tzinfo=timezone.utc)
        assert end == datetime(2026, 2, 25, 4, 0, 0, tzinfo=timezone.utc)


class TestReminderServiceGetMessage:
    """Tests for ReminderService.get_reminder_message (async with mocked UnitOfWork)."""

    def _make_service(self, mock_task_repo: AsyncMock):
        from app.services.reminder_service import ReminderService
        mock_uow = AsyncMock()
        mock_uow.tasks = mock_task_repo
        mock_uow.commit = AsyncMock()
        return ReminderService(uow=mock_uow)

    @pytest.mark.asyncio
    async def test_get_reminder_message_uses_repo_counts(self):
        """ReminderService calls the task repo and returns a message."""
        mock_task_repo = AsyncMock()
        mock_task_repo.count_tasks_in_window.return_value = 4
        mock_task_repo.count_done_tasks_in_window.return_value = 4

        service = self._make_service(mock_task_repo)
        now = datetime(2026, 2, 24, 10, 0, 0, tzinfo=timezone.utc)
        message = await service.get_reminder_message(user_id="user1", now=now)

        assert message == "Good job! Time to take a rest and enjoy your time."
        mock_task_repo.count_tasks_in_window.assert_called_once()
        mock_task_repo.count_done_tasks_in_window.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_reminder_message_defaults_to_utc_now(self):
        """When now is not supplied, the service uses UTC now."""
        mock_task_repo = AsyncMock()
        mock_task_repo.count_tasks_in_window.return_value = 0
        mock_task_repo.count_done_tasks_in_window.return_value = 0

        service = self._make_service(mock_task_repo)
        # Should not raise — returns a valid message string
        message = await service.get_reminder_message(user_id="user1")
        assert isinstance(message, str)
        assert len(message) > 0

    @pytest.mark.asyncio
    async def test_get_reminder_message_passes_correct_window(self):
        """The window_start/window_end passed to the repo matches the 4am boundary."""
        mock_task_repo = AsyncMock()
        mock_task_repo.count_tasks_in_window.return_value = 0
        mock_task_repo.count_done_tasks_in_window.return_value = 0

        service = self._make_service(mock_task_repo)
        now = datetime(2026, 2, 24, 12, 0, 0, tzinfo=timezone.utc)
        await service.get_reminder_message(user_id="user1", now=now)

        call_kwargs = mock_task_repo.count_tasks_in_window.call_args[1]
        expected_start = datetime(2026, 2, 24, 4, 0, 0, tzinfo=timezone.utc)
        expected_end = datetime(2026, 2, 25, 4, 0, 0, tzinfo=timezone.utc)
        assert call_kwargs["window_start"] == expected_start
        assert call_kwargs["window_end"] == expected_end
