"""
Reminder service — FR-07 business logic.

Rules (evaluated top-to-bottom, first match wins):
1. >50% NOT done AND after 1am  → sleep message
2. ALL done AND after 6pm        → future-you message
3. ALL done AND before 6pm       → rest message
4. >50% done AND after 6pm       → hurry up message
5. >50% done AND before 6pm      → keep it up message
6. ≤50% done AND after 6pm       → day ending message
7. ≤50% done AND before 6pm      → good day message

"after 6pm"  = hour >= 18 OR hour < 4   (18, 19, … 23, 0, 1, 2, 3)
"before 6pm" = 4 <= hour < 18           (4, 5, … 17)
"after 1am"  = hour >= 1 AND hour < 4   OR  hour > 1  …
               more precisely: hour >= 1 within the 0–3 range, i.e. 1 <= hour <= 3
               BUT also 1am = hour 1 (>= 1), so: hour == 1, 2, or 3
               Rule 1 triggers at hours: 1, 2, 3 (post-midnight, pre-4am)
"""
from datetime import datetime, timedelta, timezone


# ---------------------------------------------------------------------------
# Pure helper: 4am–4am day window
# ---------------------------------------------------------------------------

def get_day_window(dt: datetime) -> tuple[datetime, datetime]:
    """
    Return (window_start, window_end) for the 4am–4am day containing `dt`.

    If dt is between 00:00 and 03:59, it belongs to the previous calendar day's window.
    """
    if dt.hour < 4:
        # Before 4am → belongs to previous day's window
        window_start = dt.replace(hour=4, minute=0, second=0, microsecond=0) - timedelta(days=1)
    else:
        window_start = dt.replace(hour=4, minute=0, second=0, microsecond=0)
    window_end = window_start + timedelta(days=1)
    return window_start, window_end


# ---------------------------------------------------------------------------
# Pure function: reminder message computation
# ---------------------------------------------------------------------------

def _is_after_6pm(hour: int) -> bool:
    """
    True when the clock time is >= 18:00 OR midnight–03:59.
    Within the 4am–4am day boundary, hours 18–23 and 0–3 are all "past 6pm".
    """
    return hour >= 18 or hour < 4


def _is_after_1am(hour: int) -> bool:
    """
    True when the clock time is in the post-midnight zone: 1am, 2am, or 3am.
    Rule 1 specifically fires after 1am (late-night guilt message).
    """
    return 1 <= hour <= 3


def compute_reminder_message(
    total_today: int,
    done_today: int,
    current_hour: int,
) -> str:
    """
    Compute the reminder banner message given task progress and current hour.

    Args:
        total_today:  Total number of tasks due today (4am–4am window).
        done_today:   Number of those tasks with status == done.
        current_hour: Current hour in 24h format (0–23) in the server timezone.

    Returns:
        The reminder message string.
    """
    after_6pm = _is_after_6pm(current_hour)
    after_1am = _is_after_1am(current_hour)

    # Fraction done (use float to avoid integer division issues)
    fraction_done = done_today / total_today if total_today > 0 else 1.0
    majority_done = fraction_done > 0.5
    all_done = total_today == 0 or done_today == total_today

    # Rule 1: majority NOT done AND after 1am
    if not majority_done and after_1am:
        return "What's done is done. Go to sleep and try harder tomorrow."

    # Rule 2: ALL done AND after 6pm
    if all_done and after_6pm:
        return "Good job! Now it's time to help the future you!"

    # Rule 3: ALL done AND before 6pm
    if all_done and not after_6pm:
        return "Good job! Time to take a rest and enjoy your time."

    # Rule 4: majority done AND after 6pm
    if majority_done and after_6pm:
        return "Need to hurry up!"

    # Rule 5: majority done AND before 6pm
    if majority_done and not after_6pm:
        return "Good progress, keep it up!"

    # Rule 6: half or fewer done AND after 6pm
    if after_6pm:
        return "The day is ending. Manage wisely if you missed the deadline."

    # Rule 7: half or fewer done AND before 6pm
    return "Good day. Let's keep going!"


# ---------------------------------------------------------------------------
# Service class (for use with async repository)
# ---------------------------------------------------------------------------

class ReminderService:
    """
    Reminder service. Computes the current reminder message for a user.

    Depends on a unit of work to count today's tasks and their completion.
    """

    def __init__(self, uow) -> None:
        self._uow = uow

    async def get_reminder_message(
        self, user_id, now: datetime | None = None
    ) -> str:
        """
        Compute and return the current reminder message for the given user.

        Args:
            user_id: The authenticated user's ID.
            now:     Current datetime (injectable for testing). Defaults to UTC now.
        """
        if now is None:
            now = datetime.now(tz=timezone.utc)

        window_start, window_end = get_day_window(now)

        total_today = await self._uow.tasks.count_tasks_in_window(
            user_id=user_id,
            window_start=window_start,
            window_end=window_end,
        )
        done_today = await self._uow.tasks.count_done_tasks_in_window(
            user_id=user_id,
            window_start=window_start,
            window_end=window_end,
        )

        return compute_reminder_message(
            total_today=total_today,
            done_today=done_today,
            current_hour=now.hour,
        )
