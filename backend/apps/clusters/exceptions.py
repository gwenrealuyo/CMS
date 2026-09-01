from rest_framework import status
from rest_framework.exceptions import APIException


class DuplicateWeekReport(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_code = "duplicate_week_report"
    default_detail = (
        "A weekly report for this cluster and week already exists. "
        "Choose a different week."
    )
