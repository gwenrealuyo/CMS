from decimal import Decimal
from django.conf import settings
import django.core.validators
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ("finance", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="PledgeContribution",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "amount",
                    models.DecimalField(
                        decimal_places=2,
                        max_digits=10,
                        validators=[
                            django.core.validators.MinValueValidator(Decimal("0.00"))
                        ],
                    ),
                ),
                (
                    "contribution_date",
                    models.DateField(default=django.utils.timezone.now),
                ),
                ("note", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "pledge",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="contributions",
                        to="finance.pledge",
                    ),
                ),
                (
                    "contributor",
                    models.ForeignKey(
                        blank=True,
                        help_text="Person who made this contribution",
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="pledge_contributions_made",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "recorded_by",
                    models.ForeignKey(
                        blank=True,
                        help_text="Staff member who logged this contribution",
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="pledge_contributions",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-contribution_date", "-created_at"],
            },
        ),
    ]
