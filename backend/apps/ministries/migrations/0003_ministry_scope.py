from django.db import migrations, models


def _unique_code(Ministry, base: str, pk: int) -> str:
    candidate = (base or f"MIN{pk}")[:50]
    if not Ministry.objects.filter(code=candidate).exclude(pk=pk).exists():
        return candidate
    suffix = 2
    while True:
        trimmed = f"{candidate[: max(1, 50 - len(str(suffix)) - 1)]}-{suffix}"
        if not Ministry.objects.filter(code=trimmed).exclude(pk=pk).exists():
            return trimmed
        suffix += 1


def forwards_set_scope_and_codes(apps, schema_editor):
    Ministry = apps.get_model("ministries", "Ministry")
    Ministry.objects.filter(branch_id__isnull=False).update(scope="BRANCH")
    Ministry.objects.filter(branch_id__isnull=True).update(scope="NATIONAL")

    for ministry in Ministry.objects.all().order_by("pk"):
        if ministry.code:
            continue
        raw = "".join(ch for ch in (ministry.name or "").upper() if ch.isalnum())
        base = (raw[:8] if raw else f"MIN{ministry.pk}") or f"MIN{ministry.pk}"
        ministry.code = _unique_code(Ministry, base, ministry.pk)
        ministry.save(update_fields=["code"])


def backwards_noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("ministries", "0002_ministry_branch_alter_ministrymember_join_date"),
    ]

    operations = [
        migrations.AddField(
            model_name="ministry",
            name="code",
            field=models.CharField(
                blank=True,
                help_text="Short shortcut name for the ministry (e.g. WORSHIP).",
                max_length=50,
                null=True,
                unique=True,
            ),
        ),
        migrations.AddField(
            model_name="ministry",
            name="scope",
            field=models.CharField(
                choices=[("BRANCH", "Branch"), ("NATIONAL", "National")],
                default="BRANCH",
                help_text="BRANCH = one local branch; NATIONAL = visible across all branches.",
                max_length=20,
            ),
        ),
        migrations.RunPython(forwards_set_scope_and_codes, backwards_noop),
        migrations.AddConstraint(
            model_name="ministry",
            constraint=models.CheckConstraint(
                check=(
                    models.Q(scope="NATIONAL", branch__isnull=True)
                    | models.Q(scope="BRANCH", branch__isnull=False)
                ),
                name="ministries_scope_branch_consistency",
            ),
        ),
    ]
