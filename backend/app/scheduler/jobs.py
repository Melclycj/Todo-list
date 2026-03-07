"""
APScheduler job definitions.

Jobs:
- archive_and_spawn:       Daily at 4am — archive yesterday's done tasks + spawn recurring instances.
- push_reminder_at_6pm:    Daily at 6pm — broadcast reminder update via SSE.
- push_reminder_at_1am:    Daily at 1am — broadcast reminder update via SSE.

Each job creates its own short-lived database session to avoid stale state
between runs. The session factory is passed in at scheduler creation time.
"""
import logging
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)


def create_scheduler(
    session_factory,
    sse_manager,
    timezone_str: str = "UTC",
) -> AsyncIOScheduler:
    """
    Build and return an AsyncIOScheduler with all jobs registered.

    Args:
        session_factory:  Callable that returns an async session context manager.
        sse_manager:      Instance of SSEConnectionManager.
        timezone_str:     Timezone string (e.g. "UTC", "America/New_York").
    """
    scheduler = AsyncIOScheduler(timezone=timezone_str)

    async def _archive_and_spawn():
        """4am job: archive done tasks + create recurring instances."""
        from app.unit_of_work import UnitOfWork
        from app.services.task_service import TaskService
        from app.services.recurring_service import RecurringService

        now = datetime.now(tz=timezone.utc)
        today_4am = now.replace(minute=0, second=0, microsecond=0)

        async with session_factory() as session:
            uow = UnitOfWork(session)
            task_service = TaskService(uow=uow, sse_manager=sse_manager)
            recurring_service = RecurringService(uow=uow)

            try:
                archived = await task_service.archive_done_tasks(today_4am=today_4am)
                logger.info("Archived %d tasks at 4am", archived)
            except Exception:
                logger.exception("Error during archive_done_tasks job")
                await uow.rollback()

            try:
                created = await recurring_service.create_due_instances(now=now)
                logger.info("Created %d recurring instances at 4am", created)
            except Exception:
                logger.exception("Error during create_recurring_instances job")
                await uow.rollback()

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
