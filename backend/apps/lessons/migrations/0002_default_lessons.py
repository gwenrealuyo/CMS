from django.db import migrations


LESSON_DEFINITIONS = [
    {
        "code": "new-converts-course-01",
        "order": 1,
        "title": "God: Who Is He?",
        "summary": "There is only ONE TRUE GOD; today we know Him as the LORD JESUS CHRIST.",
        "outline": (
            "• There is only ONE TRUE GOD; today we know Him as the LORD JESUS CHRIST.\n"
            '• Key Verse: John 14:7 — "If ye had known me, ye should have known my Father also: '
            'and from henceforth ye know him, and have seen him."'
        ),
        "journey_title": "Completed Lesson 1: God — Who Is He?",
        "journey_note": (
            "Celebrated the revelation of the one true God in the Lord Jesus Christ "
            "(John 14:7)."
        ),
    },
    {
        "code": "new-converts-course-02",
        "order": 2,
        "title": "The Sure Way to Heaven",
        "summary": (
            "Man has fallen from God's glory, yet Jesus' death, burial, and resurrection "
            "became the good news providing the sure way to heaven for all who obey."
        ),
        "outline": (
            "• Humanity fell from the glory of God by disobedience, but Jesus provided the ransom for our redemption.\n"
            "• His death, burial, and resurrection became the good news that provides the sure way to heaven for all who obey.\n"
            '• Key Verse: Mark 16:15-16 — "Go ye into all the world, and preach the gospel to every creature. '
            'He that believeth and is baptized shall be saved; but he that believeth not shall be damned."'
        ),
        "journey_title": "Completed Lesson 2: The Sure Way to Heaven",
        "journey_note": (
            "Affirmed the gospel response of faith, baptism, and obedience "
            "(Mark 16:15-16)."
        ),
    },
    {
        "code": "new-converts-course-03",
        "order": 3,
        "title": "Clustering – The Apostolic Way of Small Group Ministry",
        "summary": (
            "Having found the true Christ and Gospel, disciples continue their growth "
            "by joining a church Cluster—their immediate spiritual family."
        ),
        "outline": (
            "• Join a church Cluster to become part of an immediate spiritual family that helps you grow in grace and knowledge.\n"
            "• Key Verses: Acts 2:46-47 — continuing daily with one accord, breaking bread from house to house, "
            "and the Lord adding to the church daily such as should be saved."
        ),
        "journey_title": "Completed Lesson 3: Clustering — Apostolic Small Groups",
        "journey_note": (
            "Joined a church cluster to continue growing in grace " "(Acts 2:46-47)."
        ),
    },
    {
        "code": "new-converts-course-04",
        "order": 4,
        "title": "Prayer – Communicating with God",
        "summary": (
            "Just as relationships grow through communication, believers nurture their "
            "relationship with God through prayer."
        ),
        "outline": (
            "• Build your relationship with God by communicating with Him through prayer.\n"
            "• Key Verse: Ephesians 6:18 — praying always with all prayer and supplication in the Spirit, "
            "watching with perseverance for all saints."
        ),
        "journey_title": "Completed Lesson 4: Prayer — Communicating with God",
        "journey_note": (
            "Committed to ongoing communication with God through Spirit-led prayer "
            "(Ephesians 6:18)."
        ),
    },
    {
        "code": "new-converts-course-05",
        "order": 5,
        "title": "The Fast That God Has Chosen",
        "summary": (
            "Fasting is biblical; it brings many physical and spiritual benefits to the believer."
        ),
        "outline": (
            "• As Christians we ought to practice fasting because it is biblical and full of benefits.\n"
            "• Key Verses: Isaiah 58:6-8 — the fast God has chosen to loose bands of wickedness, undo heavy burdens, "
            "free the oppressed, and bring restorative blessing."
        ),
        "journey_title": "Completed Lesson 5: The Fast That God Has Chosen",
        "journey_note": (
            "Received the call to biblical fasting with compassion and holiness "
            "(Isaiah 58:6-8)."
        ),
    },
    {
        "code": "new-converts-course-06",
        "order": 6,
        "title": "Tithing – The Key that Opens the Windows of Heaven",
        "summary": (
            "The godly principle of tithing unlocks the windows of heaven and secures "
            "God's promise to bless and protect our finances."
        ),
        "outline": (
            "• The secret to man's financial stability lies hidden in the godly principle of tithing.\n"
            "• God promises to bless and protect the financial and material interests of those who practice it.\n"
            '• Key Verse: Malachi 3:10 — "Bring ye all the tithes into the storehouse..."'
        ),
        "journey_title": "Completed Lesson 6: Tithing — Windows of Heaven",
        "journey_note": (
            "Committed to faithful tithing and experienced God's promise of provision "
            "(Malachi 3:10)."
        ),
    },
    {
        "code": "new-converts-course-07",
        "order": 7,
        "title": "To Obey Is Better Than Sacrifice",
        "summary": "Obedience to God's word is the key to a complete and joyful life.",
        "outline": (
            "• Our obedience to God's word is the key to a complete and joyful life.\n"
            '• Key Verse: 1 Samuel 15:22 — "Behold, to obey is better than sacrifice, and to hearken than the fat of rams."'
        ),
        "journey_title": "Completed Lesson 7: To Obey Is Better Than Sacrifice",
        "journey_note": (
            "Chose obedient discipleship over mere sacrifice (1 Samuel 15:22)."
        ),
    },
]


def seed_default_lessons(apps, schema_editor):
    Lesson = apps.get_model("lessons", "Lesson")
    LessonJourney = apps.get_model("lessons", "LessonJourney")

    for idx, definition in enumerate(LESSON_DEFINITIONS, start=1):
        lesson, created = Lesson.objects.get_or_create(
            code=definition["code"],
            version_label="v1",
            defaults={
                "order": definition.get("order", idx),
                "title": definition["title"],
                "summary": definition.get("summary", ""),
                "outline": definition.get("outline", ""),
                "is_latest": True,
                "is_active": True,
            },
        )

        if created:
            LessonJourney.objects.create(
                lesson=lesson,
                journey_type="LESSON",
                title_template=definition.get("journey_title", ""),
                note_template=definition.get("journey_note", ""),
            )


def remove_default_lessons(apps, schema_editor):
    Lesson = apps.get_model("lessons", "Lesson")
    codes = [lesson["code"] for lesson in LESSON_DEFINITIONS]
    Lesson.objects.filter(code__in=codes, version_label="v1").delete()


class Migration(migrations.Migration):

    dependencies = [
        ("lessons", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_default_lessons, remove_default_lessons),
    ]
