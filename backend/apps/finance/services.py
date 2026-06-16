from datetime import date
from decimal import Decimal
from typing import Dict, Iterable, List, Optional, TypedDict

from django.db.models import Sum, F, QuerySet, Count, Avg
from django.db.models.functions import TruncWeek, Coalesce

from .models import Donation, Offering, Pledge, PledgeContribution


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


class MonthlyGivingTrendPoint(TypedDict):
    month: int
    donation_total: float
    offering_total: float
    pledge_contribution_total: float


def _donations_queryset(
    *,
    start: Optional[date] = None,
    end: Optional[date] = None,
    branch_id: Optional[int] = None,
) -> QuerySet[Donation]:
    queryset = Donation.objects.all()
    if start:
        queryset = queryset.filter(date__gte=start)
    if end:
        queryset = queryset.filter(date__lte=end)
    if branch_id is not None:
        queryset = queryset.filter(donor__branch_id=branch_id)
    return queryset


def _pledges_queryset(*, branch_id: Optional[int] = None) -> QuerySet[Pledge]:
    queryset = Pledge.objects.all()
    if branch_id is not None:
        queryset = queryset.filter(pledger__branch_id=branch_id)
    return queryset


def _year_date_bounds(year: int) -> tuple[date, date]:
    return date(year, 1, 1), date(year, 12, 31)


def donation_stats(
    start: Optional[date] = None,
    end: Optional[date] = None,
    *,
    branch_id: Optional[int] = None,
) -> DonationStats:
    """Calculate donation statistics including totals, counts, averages, and purpose breakdown."""
    queryset = _donations_queryset(start=start, end=end, branch_id=branch_id)

    totals = queryset.aggregate(
        total_amount=Sum("amount"),
        donation_count=Count("id"),
        average_donation=Avg("amount"),
    )

    total_amount = float(totals["total_amount"] or Decimal("0.00"))
    donation_count = totals["donation_count"] or 0
    average_donation = float(totals["average_donation"] or Decimal("0.00"))

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


def weekly_offering_totals(
    start: Optional[date] = None,
    end: Optional[date] = None,
    *,
    branch_id: Optional[int] = None,
) -> List[OfferingWeeklyTotal]:
    if branch_id is not None:
        return []

    queryset: QuerySet[Offering] = Offering.objects.all()
    if start:
        queryset = queryset.filter(service_date__gte=start)
    if end:
        queryset = queryset.filter(service_date__lte=end)

    annotated = (
        queryset.annotate(week_start=TruncWeek("service_date"))
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


def pledge_summaries(
    status: Optional[Iterable[str]] = None,
    *,
    branch_id: Optional[int] = None,
) -> List[PledgeSummary]:
    queryset = _pledges_queryset(branch_id=branch_id)
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


def monthly_giving_trend(
    *,
    year: int,
    branch_id: Optional[int] = None,
) -> List[MonthlyGivingTrendPoint]:
    """Monthly donation, offering, and pledge-contribution totals for a calendar year."""
    trend: List[MonthlyGivingTrendPoint] = []
    includes_offerings = branch_id is None

    for month in range(1, 13):
        donation_filters: Dict = {"date__year": year, "date__month": month}
        if branch_id is not None:
            donation_filters["donor__branch_id"] = branch_id

        donation_total = float(
            Donation.objects.filter(**donation_filters).aggregate(
                total=Sum("amount")
            )["total"]
            or 0
        )

        offering_total = 0.0
        if includes_offerings:
            offering_total = float(
                Offering.objects.filter(
                    service_date__year=year,
                    service_date__month=month,
                ).aggregate(total=Sum("amount"))["total"]
                or 0
            )

        contribution_qs = PledgeContribution.objects.filter(
            contribution_date__year=year,
            contribution_date__month=month,
        )
        if branch_id is not None:
            contribution_qs = contribution_qs.filter(
                pledge__pledger__branch_id=branch_id
            )
        pledge_contribution_total = float(
            contribution_qs.aggregate(total=Sum("amount"))["total"] or 0
        )

        trend.append(
            MonthlyGivingTrendPoint(
                month=month,
                donation_total=donation_total,
                offering_total=offering_total,
                pledge_contribution_total=pledge_contribution_total,
            )
        )

    return trend


def generate_branch_scoped_stewardship_summary(
    *,
    branch_id: Optional[int] = None,
    year: Optional[int] = None,
) -> Dict:
    from django.utils import timezone

    if year is None:
        year = timezone.now().year

    start, end = _year_date_bounds(year)
    includes_offerings = branch_id is None

    donations = donation_stats(start, end, branch_id=branch_id)
    offerings_weekly = weekly_offering_totals(start, end, branch_id=branch_id)
    monthly_trend = monthly_giving_trend(year=year, branch_id=branch_id)
    pledges = pledge_summaries(
        status=[Pledge.Status.ACTIVE, Pledge.Status.FULFILLED],
        branch_id=branch_id,
    )

    offering_total = (
        float(
            Offering.objects.filter(
                service_date__gte=start,
                service_date__lte=end,
            ).aggregate(total=Sum("amount"))["total"]
            or 0
        )
        if includes_offerings
        else 0.0
    )

    offering_count = (
        Offering.objects.filter(
            service_date__gte=start,
            service_date__lte=end,
        ).count()
        if includes_offerings
        else 0
    )

    pledge_received_in_year = sum(
        row["pledge_contribution_total"] for row in monthly_trend
    )
    total_pledged = sum(row["pledge_amount"] for row in pledges)
    outstanding_balance = sum(row["balance"] for row in pledges)

    donation_total = donations["total_amount"]
    total_collected = donation_total + offering_total + pledge_received_in_year

    return {
        "year": year,
        "summary": {
            "total_collected": round(total_collected, 2),
            "donation_total": donation_total,
            "offering_total": offering_total,
            "pledge_received_in_year": round(pledge_received_in_year, 2),
            "total_pledged": round(total_pledged, 2),
            "outstanding_balance": round(outstanding_balance, 2),
            "donation_count": donations["donation_count"],
            "offering_count": offering_count,
            "includes_offerings": includes_offerings,
        },
        "donations": donations,
        "offerings_weekly": [
            {
                "week_start": row["week_start"].isoformat()
                if row["week_start"]
                else None,
                "total_amount": row["total_amount"],
            }
            for row in offerings_weekly
        ],
        "monthly_trend": monthly_trend,
        "pledges": pledges,
    }
