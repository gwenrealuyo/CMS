from urllib.parse import unquote

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.authentication.permissions import IsAuthenticatedAndNotVisitor

from .models import NotificationDismissal
from .services import (
    build_notification_feed,
    count_unread_alerts,
    filter_dismissed,
)


def _dismissed_keys_for_user(user):
    return set(
        NotificationDismissal.objects.filter(user=user).values_list(
            "notification_key", flat=True
        )
    )


def _feed_response(user):
    dismissed = _dismissed_keys_for_user(user)
    all_items = build_notification_feed(user)
    visible = filter_dismissed(user, all_items, dismissed)
    unread_count = count_unread_alerts(visible)
    alert_count = sum(1 for i in visible if i.category == "alert")
    activity_count = sum(1 for i in visible if i.category == "activity")
    return {
        "unread_count": unread_count,
        "alert_count": alert_count,
        "activity_count": activity_count,
        "items": [i.to_dict() for i in visible],
    }


@api_view(["GET"])
@permission_classes([IsAuthenticatedAndNotVisitor])
def notification_list_view(request):
    return Response(_feed_response(request.user))


@api_view(["POST"])
@permission_classes([IsAuthenticatedAndNotVisitor])
def notification_dismiss_view(request, notification_key):
    key = unquote(notification_key)
    NotificationDismissal.objects.get_or_create(
        user=request.user,
        notification_key=key,
    )
    return Response(_feed_response(request.user))


@api_view(["POST"])
@permission_classes([IsAuthenticatedAndNotVisitor])
def notification_dismiss_all_view(request):
    dismissed = _dismissed_keys_for_user(request.user)
    all_items = build_notification_feed(request.user)
    visible = filter_dismissed(request.user, all_items, dismissed)
    for item in visible:
        NotificationDismissal.objects.get_or_create(
            user=request.user,
            notification_key=item.key,
        )
    return Response(_feed_response(request.user))
