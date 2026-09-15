from rest_framework import status
from rest_framework.exceptions import APIException


class DuplicateMeetingReport(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_code = "duplicate_meeting_report"
    default_detail = (
        "A report for this evangelism group and meeting date already exists. "
        "Choose a different date."
    )
