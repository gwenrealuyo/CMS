from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Sum
from django.db.models.functions import Coalesce
from django.utils import timezone


class Donation(models.Model):
    class PaymentMethod(models.TextChoices):
        CASH = "CASH", "Cash"
        CHECK = "CHECK", "Check"
        BANK_TRANSFER = "BANK_TRANSFER", "Bank Transfer"
        CARD = "CARD", "Card"
        DIGITAL_WALLET = "DIGITAL_WALLET", "Digital Wallet"

    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    date = models.DateField()
    donor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="donations",
    )
    purpose = models.CharField(max_length=200)
    is_anonymous = models.BooleanField(default=False)
    payment_method = models.CharField(
        max_length=50,
        choices=PaymentMethod.choices,
        default=PaymentMethod.CASH,
    )
    receipt_number = models.CharField(max_length=50, unique=True)
    notes = models.TextField(blank=True)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="recorded_finance_entries",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date", "-created_at"]

    def __str__(self) -> str:
        return f"Donation {self.receipt_number} - {self.amount}"


class Offering(models.Model):
    service_date = models.DateField(default=timezone.now)
    service_name = models.CharField(max_length=150, help_text="e.g. Sunday AM Service")
    fund = models.CharField(
        max_length=120, blank=True, help_text="Optional fund designation"
    )
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    notes = models.TextField(blank=True)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="recorded_offerings",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-service_date", "-created_at"]

    def __str__(self) -> str:
        return f"Offering {self.service_name} on {self.service_date} - {self.amount}"


class Pledge(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        FULFILLED = "FULFILLED", "Fulfilled"
        CANCELLED = "CANCELLED", "Cancelled"

    pledger = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pledges",
    )
    pledge_title = models.CharField(
        max_length=150, help_text="Short description of the pledge"
    )
    pledge_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    amount_received = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    start_date = models.DateField(default=timezone.now)
    target_date = models.DateField(null=True, blank=True)
    purpose = models.CharField(max_length=200, blank=True)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.ACTIVE
    )
    notes = models.TextField(blank=True)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="recorded_pledges",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["status", "target_date", "pledge_title"]

    def __str__(self) -> str:
        return f"Pledge {self.pledge_title} - {self.pledge_amount}"

    def contributions_total(self) -> Decimal:
        if hasattr(self, "_contributions_total"):
            return self._contributions_total
        total = self.contributions.aggregate(
            total=Coalesce(Sum("amount"), Decimal("0.00"))
        )["total"]
        if total is None:
            total = Decimal("0.00")
        # Cast to Decimal to avoid float from database backend
        total = Decimal(total)
        self._contributions_total = total
        return total

    def effective_amount_received(self) -> Decimal:
        total = self.contributions_total()
        if total == Decimal("0.00") and self.amount_received:
            return self.amount_received
        return total

    def refresh_amount_received(self, commit: bool = True) -> Decimal:
        total = self.contributions_total()
        self.amount_received = total
        if commit:
            self.save(update_fields=["amount_received", "updated_at"])
        return total

    @property
    def balance(self) -> Decimal:
        return self.pledge_amount - self.effective_amount_received()

    @property
    def progress_percent(self) -> float:
        if self.pledge_amount:
            received = self.effective_amount_received()
            return float((received / self.pledge_amount) * 100)
        return 0.0


class PledgeContribution(models.Model):
    pledge = models.ForeignKey(
        Pledge,
        on_delete=models.CASCADE,
        related_name="contributions",
    )
    contributor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pledge_contributions_made",
        help_text="Person who made this contribution",
    )
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    contribution_date = models.DateField(default=timezone.now)
    note = models.TextField(blank=True)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pledge_contributions",
        help_text="Staff member who logged this contribution",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-contribution_date", "-created_at"]

    def __str__(self) -> str:
        return f"Contribution {self.amount} to {self.pledge}"
