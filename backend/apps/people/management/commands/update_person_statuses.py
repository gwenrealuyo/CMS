"""
Management command to update person statuses based on attendance patterns.
"""
from django.core.management.base import BaseCommand
from apps.people.models import Person
from apps.people.utils import update_person_status


class Command(BaseCommand):
    help = "Update person statuses based on attendance patterns (4-week rolling window)"

    def add_arguments(self, parser):
        parser.add_argument(
            '--person-id',
            type=int,
            help='Update specific person by ID'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be updated without making changes'
        )
        parser.add_argument(
            '--role',
            type=str,
            help='Filter by role (e.g., MEMBER, VISITOR)'
        )

    def handle(self, *args, **options):
        person_id = options.get('person_id')
        dry_run = options.get('dry_run', False)
        role_filter = options.get('role')

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN MODE - No changes will be saved'))

        # Get persons to update
        if person_id:
            persons = Person.objects.filter(id=person_id)
            if not persons.exists():
                self.stdout.write(self.style.ERROR(f'Person with ID {person_id} not found'))
                return
        else:
            # Get all persons, optionally filtered by role
            persons = Person.objects.all()
            if role_filter:
                persons = persons.filter(role=role_filter)

        total = persons.count()
        updated = 0
        unchanged = 0
        errors = 0
        status_changes = {
            'ACTIVE': 0,
            'SEMIACTIVE': 0,
            'INACTIVE': 0,
        }

        self.stdout.write(f'Processing {total} person(s)...')

        for person in persons:
            try:
                old_status = person.status
                
                if dry_run:
                    # Calculate what the new status would be
                    from apps.people.utils import calculate_person_attendance_status
                    new_status = calculate_person_attendance_status(person)
                    
                    if new_status and new_status != old_status:
                        self.stdout.write(
                            f'  {person.username} ({person.get_full_name()}): '
                            f'{old_status or "None"} → {new_status}'
                        )
                        updated += 1
                        status_changes[new_status] = status_changes.get(new_status, 0) + 1
                    else:
                        unchanged += 1
                else:
                    # Actually update
                    was_updated = update_person_status(person)
                    person.refresh_from_db()
                    
                    if was_updated:
                        updated += 1
                        new_status = person.status
                        status_changes[new_status] = status_changes.get(new_status, 0) + 1
                        self.stdout.write(
                            self.style.SUCCESS(
                                f'  Updated {person.username} ({person.get_full_name()}): '
                                f'{old_status or "None"} → {new_status}'
                            )
                        )
                    else:
                        unchanged += 1
            except Exception as e:
                errors += 1
                self.stdout.write(
                    self.style.ERROR(f'  Error updating {person.username}: {str(e)}')
                )

        # Summary
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('=' * 60))
        self.stdout.write(self.style.SUCCESS('Summary'))
        self.stdout.write(self.style.SUCCESS('=' * 60))
        self.stdout.write(f'Total processed: {total}')
        self.stdout.write(f'Updated: {updated}')
        self.stdout.write(f'Unchanged: {unchanged}')
        if errors > 0:
            self.stdout.write(self.style.ERROR(f'Errors: {errors}'))
        
        if updated > 0:
            self.stdout.write('')
            self.stdout.write('Status changes:')
            for status, count in status_changes.items():
                if count > 0:
                    self.stdout.write(f'  {status}: {count}')

