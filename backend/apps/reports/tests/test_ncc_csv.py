from django.test import SimpleTestCase

from apps.reports.services import build_ncc_summary_csv


class NccSummaryCsvTests(SimpleTestCase):
    def test_assigned_status_labeled_not_started(self):
        csv_text = build_ncc_summary_csv(
            {
                "year": 2026,
                "total_participants": 3,
                "unassigned_visitors": 1,
                "overall": {
                    "ASSIGNED": 1,
                    "IN_PROGRESS": 1,
                    "COMPLETED": 1,
                },
                "lessons": [
                    {
                        "lesson_id": 1,
                        "lesson_title": "Lesson 1",
                        "completed": 1,
                        "in_progress": 1,
                        "assigned": 1,
                        "skipped": 0,
                        "total": 3,
                    }
                ],
            }
        )

        self.assertIn("Not started,1", csv_text)
        self.assertIn("Not started", csv_text)
        self.assertNotIn("ASSIGNED", csv_text)
        self.assertNotIn(",Assigned,", csv_text)
        self.assertNotIn("Assigned\n", csv_text)
        self.assertNotIn("Assigned,", csv_text)
