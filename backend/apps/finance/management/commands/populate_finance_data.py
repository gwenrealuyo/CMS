"""
Management command to populate the database with sample finance data
Usage: python manage.py populate_finance_data
"""

from django.core.management.base import BaseCommand
from apps.finance.models import Donation, Offering, Pledge, PledgeContribution
from apps.people.models import Person
from datetime import datetime, timedelta, date
from decimal import Decimal
import random


class Command(BaseCommand):
    help = "Populates the database with sample finance data for testing"

    def add_arguments(self, parser):
        parser.add_argument(
            "--donations",
            type=int,
            default=30,
            help="Number of donations to create (default: 30)",
        )
        parser.add_argument(
            "--offerings",
            type=int,
            default=12,
            help="Number of weekly offerings to create (default: 12)",
        )
        parser.add_argument(
            "--pledges",
            type=int,
            default=8,
            help="Number of pledges to create (default: 8)",
        )
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Clear existing finance data before populating",
        )

    def handle(self, *args, **options):
        num_donations = options["donations"]
        num_offerings = options["offerings"]
        num_pledges = options["pledges"]
        clear_existing = options["clear"]

        if clear_existing:
            self.stdout.write("Clearing existing finance data...")
            PledgeContribution.objects.all().delete()
            Pledge.objects.all().delete()
            Offering.objects.all().delete()
            Donation.objects.all().delete()

        self.stdout.write("Creating sample finance data...")

        # Get some people to use as donors/pledgers/recorders
        people = list(Person.objects.all()[:20])
        if not people:
            self.stdout.write(
                self.style.WARNING(
                    "No people found in database. Please run populate_sample_data first."
                )
            )
            return

        # Get a staff member for recorded_by
        staff = people[0] if people else None

        # Purposes for donations
        purposes = [
            "Tithe",
            "Offering",
            "Building Fund",
            "Missions",
            "Youth Ministry",
            "Children's Ministry",
            "Benevolence",
            "Special Project",
        ]

        payment_methods = [
            Donation.PaymentMethod.CASH,
            Donation.PaymentMethod.CHECK,
            Donation.PaymentMethod.BANK_TRANSFER,
            Donation.PaymentMethod.CARD,
            Donation.PaymentMethod.DIGITAL_WALLET,
        ]

        # Create Donations
        donations = []
        # Find the highest existing receipt number to avoid duplicates
        existing_receipts = Donation.objects.filter(
            receipt_number__startswith="REC-"
        ).values_list("receipt_number", flat=True)

        receipt_counter = 1000
        if existing_receipts:
            # Extract numeric part from existing receipts and find max
            max_num = 0
            for receipt in existing_receipts:
                try:
                    # Extract number from "REC-001234" format
                    num_part = receipt.split("-")[1]
                    num = int(num_part)
                    max_num = max(max_num, num)
                except (ValueError, IndexError):
                    continue
            receipt_counter = max_num + 1

        for i in range(num_donations):
            # Random date within last 6 months
            days_ago = random.randint(0, 180)
            donation_date = date.today() - timedelta(days=days_ago)

            # 70% have donors, 30% anonymous
            is_anonymous = random.random() < 0.3
            donor = None if is_anonymous else random.choice(people)

            # Amounts: most between 100-5000, some larger
            if random.random() < 0.1:
                amount = Decimal(random.randint(5000, 20000))
            else:
                amount = Decimal(random.randint(100, 5000))

            # Generate unique receipt number
            receipt_number = f"REC-{receipt_counter:06d}"
            # Ensure uniqueness (in case of race conditions)
            while Donation.objects.filter(receipt_number=receipt_number).exists():
                receipt_counter += 1
                receipt_number = f"REC-{receipt_counter:06d}"

            donation = Donation(
                amount=amount,
                date=donation_date,
                donor=donor,
                purpose=random.choice(purposes),
                is_anonymous=is_anonymous,
                payment_method=random.choice(payment_methods),
                receipt_number=receipt_number,
                notes=(
                    f"Donation for {random.choice(purposes)}"
                    if random.random() < 0.3
                    else ""
                ),
                recorded_by=staff,
            )
            donation.save()
            donations.append(donation)
            receipt_counter += 1

        self.stdout.write(self.style.SUCCESS(f"✓ Created {len(donations)} donations"))

        # Create Offerings (weekly Sunday services)
        offerings = []
        service_names = [
            "Sunday AM Service",
            "Sunday PM Service",
            "Sunday Evening Service",
            "Midweek Service",
        ]

        funds = ["General Fund", "Building Fund", "Missions", ""]

        # Start from 12 weeks ago
        for i in range(num_offerings):
            weeks_ago = num_offerings - i - 1
            service_date = date.today() - timedelta(weeks=weeks_ago)

            # Most offerings on Sunday, some midweek
            if random.random() < 0.8:
                # Adjust to nearest Sunday
                days_since_sunday = service_date.weekday() - 6  # Sunday is 6
                if days_since_sunday != 0:
                    service_date = service_date - timedelta(days=days_since_sunday)

            # Amounts typically 5000-50000 for weekly offerings
            amount = Decimal(random.randint(5000, 50000))

            offering = Offering(
                service_date=service_date,
                service_name=random.choice(service_names),
                fund=random.choice(funds) if random.random() < 0.4 else "",
                amount=amount,
                notes=(
                    f"Offering from {random.choice(service_names)}"
                    if random.random() < 0.2
                    else ""
                ),
                recorded_by=staff,
            )
            offering.save()
            offerings.append(offering)

        self.stdout.write(self.style.SUCCESS(f"✓ Created {len(offerings)} offerings"))

        # Create Pledges with contributions
        pledges = []
        pledge_titles = [
            "Building Fund Campaign 2024",
            "Missions Support Pledge",
            "Youth Center Construction",
            "Church Van Purchase",
            "Renovation Project",
            "Outreach Program",
            "Equipment Upgrade",
            "Scholarship Fund",
        ]

        statuses = [
            Pledge.Status.ACTIVE,
            Pledge.Status.ACTIVE,
            Pledge.Status.ACTIVE,
            Pledge.Status.FULFILLED,
            Pledge.Status.CANCELLED,
        ]

        for i in range(num_pledges):
            # Random date within last year
            days_ago = random.randint(0, 365)
            start_date = date.today() - timedelta(days=days_ago)

            # Target date: 30-180 days from start
            target_date = start_date + timedelta(days=random.randint(30, 180))

            # Pledge amounts: 10000-200000
            pledge_amount = Decimal(random.randint(10000, 200000))

            # Status distribution
            status = random.choice(statuses)

            # Select pledger (70% have pledgers, 30% anonymous)
            has_pledger = random.random() < 0.7
            pledger = random.choice(people) if has_pledger else None

            pledge = Pledge(
                pledger=pledger,
                pledge_title=random.choice(pledge_titles),
                pledge_amount=pledge_amount,
                amount_received=Decimal("0.00"),  # Will be updated by contributions
                start_date=start_date,
                target_date=target_date if random.random() < 0.8 else None,
                purpose=random.choice(purposes) if random.random() < 0.5 else "",
                status=status,
                notes=(
                    f"Pledge for {random.choice(pledge_titles)}"
                    if random.random() < 0.3
                    else ""
                ),
                recorded_by=staff,
            )
            pledge.save()

            # Create contributions for active/fulfilled pledges
            if status in [Pledge.Status.ACTIVE, Pledge.Status.FULFILLED]:
                # Number of contributions: 1-6
                num_contributions = random.randint(1, 6)
                total_contributed = Decimal("0.00")

                for j in range(num_contributions):
                    # Contribution date: spread from start_date to today
                    days_since_start = random.randint(
                        0, (date.today() - start_date).days
                    )
                    contribution_date = start_date + timedelta(days=days_since_start)

                    # Contribution amount: 5-30% of pledge amount per contribution
                    contribution_amount = pledge_amount * Decimal(
                        random.uniform(0.05, 0.30)
                    )
                    contribution_amount = contribution_amount.quantize(Decimal("0.01"))

                    # For fulfilled pledges, ensure total reaches pledge_amount
                    if status == Pledge.Status.FULFILLED and j == num_contributions - 1:
                        remaining = pledge_amount - total_contributed
                        if remaining > 0:
                            contribution_amount = remaining

                    total_contributed += contribution_amount

                    # Contributor: 70% same as pledger, 30% different person or None
                    contributor = None
                    if random.random() < 0.7:
                        # Use pledger if available, otherwise random person
                        if pledger:
                            contributor = pledger
                        elif people:
                            contributor = random.choice(people)
                    elif random.random() < 0.3 and people:
                        # Different person from pledger
                        other_people = [p for p in people if p != pledger]
                        if other_people:
                            contributor = random.choice(other_people)

                    contribution = PledgeContribution(
                        pledge=pledge,
                        contributor=contributor,
                        amount=contribution_amount,
                        contribution_date=contribution_date,
                        note=(
                            f"Installment {j + 1} of {num_contributions}"
                            if random.random() < 0.4
                            else ""
                        ),
                        recorded_by=staff,
                    )
                    contribution.save()

                # Refresh pledge amount_received from contributions
                pledge.refresh_amount_received()

                # If fulfilled, ensure status is correct
                if pledge.effective_amount_received() >= pledge.pledge_amount:
                    pledge.status = Pledge.Status.FULFILLED
                    pledge.save()

            pledges.append(pledge)

        self.stdout.write(
            self.style.SUCCESS(f"✓ Created {len(pledges)} pledges with contributions")
        )

        # Summary
        total_donations = sum(d.amount for d in donations)
        total_offerings = sum(o.amount for o in offerings)
        total_pledged = sum(p.pledge_amount for p in pledges)
        total_received = sum(p.effective_amount_received() for p in pledges)

        self.stdout.write("\n" + "=" * 60)
        self.stdout.write(self.style.SUCCESS("Finance Sample Data Summary:"))
        self.stdout.write(
            f"  Donations: {len(donations)} (Total: ₱{total_donations:,.2f})"
        )
        self.stdout.write(
            f"  Offerings: {len(offerings)} (Total: ₱{total_offerings:,.2f})"
        )
        self.stdout.write(
            f"  Pledges: {len(pledges)} (Pledged: ₱{total_pledged:,.2f}, Received: ₱{total_received:,.2f})"
        )
        self.stdout.write("=" * 60)
