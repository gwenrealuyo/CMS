from datetime import date
from decimal import Decimal
from typing import Dict, Iterable, List, Optional, TypedDict

from django.db.models import Sum, F, QuerySet, Count, Avg
from django.db.models.functions import TruncWeek, Coalesce

from .models import Donation, Offering, Pledge


class OfferingWeeklyTotal(TypedDict):
    week_start: Optional[date]
    total_amount: float


class PledgeSummary(TypedDict):
    id: int
    pledge_title: str
    pledge_amount: float
    amount_received: float
    balance: float
    progress_percent: float
    status: str


class DonationStats(TypedDict):
    total_amount: float
    donation_count: int
    average_donation: float
    purpose_breakdown: Dict[str, float]


def donation_stats(start: Optional[date] = None, end: Optional[date] = None) -> DonationStats:
    """
    Calculate donation statistics including totals, counts, averages, and purpose breakdown.
    
    Args:
        start: Optional start date filter
        end: Optional end date filter
    
    Returns:
        DonationStats dictionary with calculated statistics
    """
    queryset: QuerySet[Donation] = Donation.objects.all()
    
    if start:
        queryset = queryset.filter(date__gte=start)
    if end:
        queryset = queryset.filter(date__lte=end)
    
    # Calculate aggregated totals
    totals = queryset.aggregate(
        total_amount=Sum("amount"),
        donation_count=Count("id"),
        average_donation=Avg("amount"),
    )
    
    total_amount = float(totals["total_amount"] or Decimal("0.00"))
    donation_count = totals["donation_count"] or 0
    average_donation = float(totals["average_donation"] or Decimal("0.00"))
    
    # Calculate purpose breakdown
    purpose_breakdown = {}
    purpose_totals = (
        queryset.values("purpose")
        .annotate(total=Sum("amount"))
        .order_by("purpose")
    )
    
    for row in purpose_totals:
        purpose = row["purpose"] or "Other"
        purpose_breakdown[purpose] = float(row["total"] or Decimal("0.00"))
    
    return DonationStats(
        total_amount=total_amount,
        donation_count=donation_count,
        average_donation=average_donation,
        purpose_breakdown=purpose_breakdown,
    )


def weekly_offering_totals(start: Optional[date] = None, end: Optional[date] = None) -> List[OfferingWeeklyTotal]:
    queryset: QuerySet[Offering] = Offering.objects.all()
    if start:
        queryset = queryset.filter(service_date__gte=start)
    if end:
        queryset = queryset.filter(service_date__lte=end)

    annotated = (
        queryset
        .annotate(week_start=TruncWeek("service_date"))
        .values("week_start")
        .annotate(total_amount=Sum("amount"))
        .order_by("week_start")
    )

    results: List[OfferingWeeklyTotal] = []
    for row in annotated:
        week_start = row["week_start"]
        if week_start and hasattr(week_start, "date"):
            week_start = week_start.date()
        results.append(
            OfferingWeeklyTotal(
                week_start=week_start,
                total_amount=float(row["total_amount"] or 0),
            )
        )
    return results


def pledge_summaries(status: Optional[Iterable[str]] = None) -> List[PledgeSummary]:
    queryset: QuerySet[Pledge] = Pledge.objects.all()
    if status:
        queryset = queryset.filter(status__in=status)

    queryset = queryset.annotate(
        balance_value=F("pledge_amount") - F("amount_received"),
        contributions_sum=Coalesce(Sum("contributions__amount"), Decimal("0.00")),
    ).order_by("status", "target_date", "pledge_title")

    summaries: List[PledgeSummary] = []
    for pledge in queryset:
        total_contributions = Decimal(pledge.contributions_sum or 0)
        pledge._contributions_total = total_contributions
        balance = pledge.balance
        amount_received = pledge.effective_amount_received()
        summaries.append(
            PledgeSummary(
                id=pledge.id,
                pledge_title=pledge.pledge_title,
                pledge_amount=float(pledge.pledge_amount),
                amount_received=float(amount_received),
                balance=float(balance),
                progress_percent=float(pledge.progress_percent),
                status=pledge.status,
            )
        )
    return summaries

