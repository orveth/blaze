"""Utility functions for the Kanban board."""

import uuid
from datetime import datetime, timezone


def generate_id() -> str:
    """Generate a unique ID for a card."""
    return uuid.uuid4().hex[:12]


def now_utc() -> datetime:
    """Get current UTC datetime."""
    return datetime.now(timezone.utc)


def is_overdue(due_date: datetime | None) -> bool:
    """Check if a due date has passed."""
    if due_date is None:
        return False
    # Make sure we compare timezone-aware datetimes
    if due_date.tzinfo is None:
        due_date = due_date.replace(tzinfo=timezone.utc)
    return due_date < now_utc()
