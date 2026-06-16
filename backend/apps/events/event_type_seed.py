"""Canonical event type rows — used by migrations RunPython and seed_event_types command."""

DEFAULT_EVENT_TYPE_COLOR = "#9CA3AF"

EVENT_TYPE_SEED = [
    ("SUNDAY_SERVICE", "Sunday Service", 10, "#1e40af"),
    ("BIBLE_STUDY", "Bible Study", 20, "#9333ea"),
    ("PRAYER_MEETING", "Prayer Meeting", 30, "#16a34a"),
    ("BS/CLUSTER_EVANGELISM", "BS/Cluster Evangelism", 40, "#0891b2"),
    ("CLUSTERING", "Clustering", 50, "#0d9488"),
    ("DOCTRINAL_CLASS", "Doctrinal Class", 60, "#ca8a04"),
    ("CYM_CLASS", "CYM Class", 70, "#db2777"),
    ("MINI_WORSHIP", "Mini Worship", 80, "#7c3aed"),
    ("GOLDEN_WARRIORS", "Golden Warriors", 90, "#b45309"),
    ("CAMPING", "Camping", 100, "#15803d"),
    ("AWTA", "AWTA", 110, "#dc2626"),
    ("CONFERENCE", "Conference", 120, "#ea580c"),
    ("SUNDAY_SCHOOL", "Sunday School", 130, "#2563eb"),
    ("CONCERT_CRUSADE", "Concert/Crusade", 150, "#7c2d12"),
]
