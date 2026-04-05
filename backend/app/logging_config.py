"""
Structured JSON logging configuration.

Call configure_logging() once at application startup (in main.py).

Output format (one JSON object per line):
  {
    "asctime":  "2026-03-08 07:30:00,123",
    "levelname": "INFO",
    "name":     "app.services.auth_service",
    "message":  "user.login",
    "user_id":  "uuid-...",
    ...extra fields...
  }

Log destination:
  - Always: stderr (captured by Docker / systemd / cloud runtimes).
  - Optional file: set LOG_FILE=/var/log/app/api.json in the environment.

Where logs end up in practice:
  - Local dev:      printed to the terminal running uvicorn
  - Docker:         docker logs <container>  (stdout/stderr captured by daemon)
  - Systemd:        journalctl -u todo-api
  - Cloud (AWS/GCP/Azure): forwarded to CloudWatch / Cloud Logging / Azure Monitor
  - Self-hosted:    pipe into Loki / Elasticsearch via a log shipper (promtail, fluentd)
"""
import logging
import sys

from pythonjsonlogger.jsonlogger import JsonFormatter


def configure_logging(log_level: str = "INFO", log_file: str = "") -> None:
    """
    Attach a JSON formatter to the root logger.

    Args:
        log_level: Logging level string ("DEBUG", "INFO", "WARNING", "ERROR").
        log_file:  If non-empty, also write logs to this file path.
    """
    fmt = JsonFormatter("%(asctime)s %(levelname)s %(name)s %(message)s")

    root = logging.getLogger()
    root.setLevel(log_level.upper())

    # Remove any handlers already attached (e.g. uvicorn's basicConfig call)
    root.handlers.clear()

    stderr_handler = logging.StreamHandler(sys.stderr)
    stderr_handler.setFormatter(fmt)
    root.addHandler(stderr_handler)

    if log_file:
        file_handler = logging.FileHandler(log_file, encoding="utf-8")
        file_handler.setFormatter(fmt)
        root.addHandler(file_handler)

    # Quieten noisy third-party loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("apscheduler").setLevel(logging.WARNING)
