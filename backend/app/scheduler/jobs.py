"""
APScheduler job definitions.

Jobs:
- archive_done_tasks:      Daily at 4am — archive yesterday's done tasks.
- create_recurring_instances: Daily at 4am — spawn new recurring task instances.
- push_reminder_at_6pm:    Daily at 6pm — broadcast reminder update via SSE.
- push_reminder_at_1am:    Daily at 1am — broadcast reminder update via SSE.
"""
import logging
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)


def create_scheduler(
    task_service,
    recurring_service,
    sse_manager,
    timezone_str: str = "UTC",
) -> AsyncIOScheduler:
    """
    Build and return an AsyncIOScheduler with all 4 jobs registered.

    Args:
        task_service:       Instance of TaskService.
        recurring_service:  Instance of RecurringService.
        sse_manager:        Instance of SSEConnectionManager.
        timezone_str:       Timezone string (e.g. "UTC", "America/New_York").
    """
    scheduler = AsyncIOScheduler(timezone=timezone_str)

    async def _archive_and_spawn():
        """4am job: archive done tasks + create recurring instances."""
        now = datetime.now(tz=timezone.utc)
        # today_4am is the current scheduler fire time (approximately 4am in server tz)
        today_4am = now.replace(minute=0, second=0, microsecond=0)

        try:
            archived = await task_service.archive_done_tasks(today_4am=today_4am)
            logger.info("Archived %d tasks at 4am", archived)
        except Exception:
            logger.exception("Error during archive_done_tasks job")

        try:
            created = await recurring_service.create_due_instances(now=now)
            logger.info("Created %d recurring instances at 4am", created)
        except Exception:
            logger.exception("Error during create_recurring_instances job")

    async def _push_reminder():
        """Broadcast a reminder update to all connected SSE clients."""
        try:
            await sse_manager.broadcast("update")
            logger.info("Pushed reminder update via SSE")
        except Exception:
            logger.exception("Error during push_reminder job")

    scheduler.add_job(
        _archive_and_spawn,
        CronTrigger(hour=4, minute=0, timezone=timezone_str),
        id="archive_and_spawn",
        replace_existing=True,
    )
    scheduler.add_job(
        _push_reminder,
        CronTrigger(hour=18, minute=0, timezone=timezone_str),
        id="push_reminder_at_6pm",
        replace_existing=True,
    )
    scheduler.add_job(
        _push_reminder,
        CronTrigger(hour=1, minute=0, timezone=timezone_str),
        id="push_reminder_at_1am",
        replace_existing=True,
    )

    return scheduler
