from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from datetime import datetime
import logging

from apps.people.models import Journey, Person
from apps.clusters.models import Cluster, ClusterWeeklyReport

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Backfill historical journey entries from existing cluster attendance and membership data"

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be created without actually creating journeys',
        )
        parser.add_argument(
            '--cluster-id',
            type=int,
            help='Process only a specific cluster',
        )
        parser.add_argument(
            '--start-date',
            type=str,
            help='Only process reports/memberships after this date (YYYY-MM-DD)',
        )
        parser.add_argument(
            '--end-date',
            type=str,
            help='Only process reports/memberships before this date (YYYY-MM-DD)',
        )
        parser.add_argument(
            '--skip-attendance',
            action='store_true',
            help='Skip attendance journey creation',
        )
        parser.add_argument(
            '--skip-membership',
            action='store_true',
            help='Skip membership journey creation',
        )

    def _get_cluster_display_name(self, cluster):
        """Get cluster code, name, or fallback identifier"""
        if cluster.code:
            return cluster.code
        if cluster.name:
            return cluster.name
        return f"Cluster {cluster.id}"

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        cluster_id = options.get('cluster_id')
        start_date = options.get('start_date')
        end_date = options.get('end_date')
        skip_attendance = options['skip_attendance']
        skip_membership = options['skip_membership']

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN MODE - No journeys will be created'))

        # Parse dates
        start_date_obj = None
        end_date_obj = None
        if start_date:
            try:
                start_date_obj = datetime.strptime(start_date, '%Y-%m-%d').date()
            except ValueError:
                self.stdout.write(self.style.ERROR(f'Invalid start-date format: {start_date}. Use YYYY-MM-DD'))
                return
        if end_date:
            try:
                end_date_obj = datetime.strptime(end_date, '%Y-%m-%d').date()
            except ValueError:
                self.stdout.write(self.style.ERROR(f'Invalid end-date format: {end_date}. Use YYYY-MM-DD'))
                return

        attendance_created = 0
        attendance_skipped = 0
        attendance_errors = 0
        membership_created = 0
        membership_skipped = 0
        membership_errors = 0

        # Process attendance journeys
        if not skip_attendance:
            self.stdout.write(self.style.SUCCESS('\n=== Processing Attendance Journeys ==='))
            
            reports_query = ClusterWeeklyReport.objects.all()
            if cluster_id:
                reports_query = reports_query.filter(cluster_id=cluster_id)
            if start_date_obj:
                reports_query = reports_query.filter(meeting_date__gte=start_date_obj)
            if end_date_obj:
                reports_query = reports_query.filter(meeting_date__lte=end_date_obj)
            
            reports = reports_query.select_related('cluster', 'submitted_by').prefetch_related(
                'members_attended', 'visitors_attended'
            )
            total_reports = reports.count()
            
            self.stdout.write(f'Found {total_reports} reports to process')
            
            for idx, report in enumerate(reports, 1):
                try:
                    cluster_display = self._get_cluster_display_name(report.cluster)
                    
                    # Process members
                    for person in report.members_attended.exclude(role="ADMIN"):
                        # Check for duplicate
                        existing = Journey.objects.filter(
                            user=person,
                            date=report.meeting_date,
                            type='CLUSTER',
                            title__startswith='Attended Cluster Meeting -'
                        ).exists()
                        
                        if existing:
                            attendance_skipped += 1
                            continue
                        
                        if not dry_run:
                            title = f"Attended Cluster Meeting - {cluster_display}"
                            description = f"Attended cluster meeting ({report.gathering_type})"
                            
                            Journey.objects.create(
                                user=person,
                                title=title,
                                date=report.meeting_date,
                                type='CLUSTER',
                                description=description,
                                verified_by=report.submitted_by
                            )
                        
                        attendance_created += 1
                    
                    # Process visitors
                    for person in report.visitors_attended.exclude(role="ADMIN"):
                        # Check for duplicate
                        existing = Journey.objects.filter(
                            user=person,
                            date=report.meeting_date,
                            type='CLUSTER',
                            title__startswith='Attended Cluster Meeting -'
                        ).exists()
                        
                        if existing:
                            attendance_skipped += 1
                            continue
                        
                        if not dry_run:
                            title = f"Attended Cluster Meeting - {cluster_display}"
                            description = f"Attended cluster meeting ({report.gathering_type})"
                            
                            Journey.objects.create(
                                user=person,
                                title=title,
                                date=report.meeting_date,
                                type='CLUSTER',
                                description=description,
                                verified_by=report.submitted_by
                            )
                        
                        attendance_created += 1
                    
                    if idx % 10 == 0:
                        self.stdout.write(f'Processed {idx}/{total_reports} reports...')
                
                except Exception as e:
                    attendance_errors += 1
                    logger.error(f"Error processing report {report.id}: {str(e)}", exc_info=True)
                    self.stdout.write(self.style.ERROR(f'Error processing report {report.id}: {str(e)}'))

        # Process membership journeys
        if not skip_membership:
            self.stdout.write(self.style.SUCCESS('\n=== Processing Membership Journeys ==='))
            
            clusters_query = Cluster.objects.all()
            if cluster_id:
                clusters_query = clusters_query.filter(id=cluster_id)
            
            clusters = clusters_query.prefetch_related('members')
            total_clusters = clusters.count()
            
            self.stdout.write(f'Found {total_clusters} clusters to process')
            
            for idx, cluster in enumerate(clusters, 1):
                try:
                    cluster_display = self._get_cluster_display_name(cluster)
                    members = cluster.members.exclude(role="ADMIN")
                    
                    # Use cluster's created_at date, or today if not reliable
                    journey_date = cluster.created_at.date() if cluster.created_at else timezone.now().date()
                    
                    # Apply date filters if provided
                    if start_date_obj and journey_date < start_date_obj:
                        continue
                    if end_date_obj and journey_date > end_date_obj:
                        continue
                    
                    for person in members:
                        # Check for duplicate (same day)
                        existing = Journey.objects.filter(
                            user=person,
                            date=journey_date,
                            type='CLUSTER',
                            title__startswith='Joined Cluster -'
                        ).exists()
                        
                        if existing:
                            membership_skipped += 1
                            continue
                        
                        if not dry_run:
                            title = f"Joined Cluster - {cluster_display}"
                            description = "Assigned to cluster"
                            
                            Journey.objects.create(
                                user=person,
                                title=title,
                                date=journey_date,
                                type='CLUSTER',
                                description=description,
                                verified_by=None  # No way to know who added them historically
                            )
                        
                        membership_created += 1
                    
                    if idx % 10 == 0:
                        self.stdout.write(f'Processed {idx}/{total_clusters} clusters...')
                
                except Exception as e:
                    membership_errors += 1
                    logger.error(f"Error processing cluster {cluster.id}: {str(e)}", exc_info=True)
                    self.stdout.write(self.style.ERROR(f'Error processing cluster {cluster.id}: {str(e)}'))

        # Summary
        self.stdout.write(self.style.SUCCESS('\n=== Summary ==='))
        if not skip_attendance:
            self.stdout.write(f'Attendance Journeys: {attendance_created} created, {attendance_skipped} skipped, {attendance_errors} errors')
        if not skip_membership:
            self.stdout.write(f'Membership Journeys: {membership_created} created, {membership_skipped} skipped, {membership_errors} errors')
        
        if dry_run:
            self.stdout.write(self.style.WARNING('\nThis was a dry run. No journeys were actually created.'))
        else:
            self.stdout.write(self.style.SUCCESS(f'\nSuccessfully created {attendance_created + membership_created} journeys.'))



