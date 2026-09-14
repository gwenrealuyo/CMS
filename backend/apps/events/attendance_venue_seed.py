"""Canonical attendance venue rows — used by migrations RunPython."""

from .event_type_seed import DEFAULT_EVENT_TYPE_COLOR

ATTENDANCE_VENUE_SEED = [
    ("HOME_ALTAR", "Home altar", 10, "#0ea5e9"),
    ("CLUSTER_HOUSE", "Cluster house", 20, "#8b5cf6"),
]

DEFAULT_ATTENDANCE_VENUE_COLOR = DEFAULT_EVENT_TYPE_COLOR
