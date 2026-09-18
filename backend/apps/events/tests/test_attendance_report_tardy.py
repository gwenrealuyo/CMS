"""Unit tests for attendance-report tardiness helpers (mirrors FE rule)."""

from datetime import datetime, timedelta
from typing import Optional
from unittest import TestCase


def is_check_in_tardy(
    recorded_at: Optional[datetime],
    occurrence_start: Optional[datetime],
    grace_minutes: int = 0,
) -> bool:
    """Mirror of frontend isCheckInTardy: late when strictly after start + grace."""
    if recorded_at is None or occurrence_start is None:
        return False
    grace = max(0, grace_minutes)
    return recorded_at > occurrence_start + timedelta(minutes=grace)


class AttendanceReportTardyRuleTests(TestCase):
    def test_exact_start_is_not_tardy_with_zero_grace(self):
        start = datetime(2026, 9, 17, 9, 0, 0)
        self.assertFalse(is_check_in_tardy(start, start, 0))

    def test_after_start_is_tardy_with_zero_grace(self):
        start = datetime(2026, 9, 17, 9, 0, 0)
        late = start + timedelta(seconds=1)
        self.assertTrue(is_check_in_tardy(late, start, 0))

    def test_within_grace_is_not_tardy(self):
        start = datetime(2026, 9, 17, 9, 0, 0)
        within = start + timedelta(minutes=14)
        self.assertFalse(is_check_in_tardy(within, start, 15))

    def test_after_grace_is_tardy(self):
        start = datetime(2026, 9, 17, 9, 0, 0)
        late = start + timedelta(minutes=15, seconds=1)
        self.assertTrue(is_check_in_tardy(late, start, 15))

    def test_before_start_is_not_tardy(self):
        start = datetime(2026, 9, 17, 9, 0, 0)
        early = start - timedelta(minutes=5)
        self.assertFalse(is_check_in_tardy(early, start, 0))
