from django.test import SimpleTestCase

from apps.clusters.utils import calculate_trend, is_at_risk


class CalculateTrendTests(SimpleTestCase):
    def test_no_reports_in_either_period_has_no_trend(self):
        self.assertIsNone(
            calculate_trend(
                {"compliance_rate": 0, "reports_submitted": 0},
                {"compliance_rate": 0, "reports_submitted": 0},
            )
        )

    def test_started_reporting_is_improving(self):
        self.assertEqual(
            calculate_trend(
                {"compliance_rate": 100, "reports_submitted": 4},
                {"compliance_rate": 0, "reports_submitted": 0},
            ),
            "IMPROVING",
        )

    def test_stopped_reporting_is_declining(self):
        self.assertEqual(
            calculate_trend(
                {"compliance_rate": 0, "reports_submitted": 0},
                {"compliance_rate": 100, "reports_submitted": 4},
            ),
            "DECLINING",
        )

    def test_same_rate_with_reports_is_stable(self):
        self.assertEqual(
            calculate_trend(
                {"compliance_rate": 100, "reports_submitted": 4},
                {"compliance_rate": 100, "reports_submitted": 4},
            ),
            "STABLE",
        )

    def test_small_change_within_threshold_is_stable(self):
        self.assertEqual(
            calculate_trend(
                {"compliance_rate": 52, "reports_submitted": 2},
                {"compliance_rate": 50, "reports_submitted": 2},
            ),
            "STABLE",
        )

    def test_missing_trend_does_not_mark_at_risk_by_trend(self):
        at_risk, reason = is_at_risk(
            {
                "consecutive_missing_weeks": 0,
                "days_since_last_report": None,
                "trend": None,
            }
        )
        self.assertFalse(at_risk)
        self.assertIsNone(reason)
