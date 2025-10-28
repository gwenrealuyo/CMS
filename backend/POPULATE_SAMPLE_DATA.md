# Populate Sample Data

This document explains how to populate the database with sample data for testing and development.

## Overview

The `populate_sample_data` management command creates realistic sample data for:

- People (Members, Visitors, Coordinators, Pastors)
- Families
- Clusters
- Milestones
- Cluster Weekly Reports

## Usage

### Basic Usage

```bash
cd backend
python manage.py populate_sample_data
```

This will create:

- 50 people
- 10 families
- 5 clusters
- Multiple milestones
- Weekly reports for clusters

### Customize the Amount of Data

You can specify how many records to create:

```bash
# Create 100 people, 20 families, and 8 clusters
python manage.py populate_sample_data --people 100 --families 20 --clusters 8
```

### Clear Existing Data First

To replace all existing data with new sample data:

```bash
python manage.py populate_sample_data --clear
```

### Command Options

```
--people N      Number of people to create (default: 50)
--families N    Number of families to create (default: 10)
--clusters N    Number of clusters to create (default: 5)
--clear         Clear existing data before populating
```

## Sample Data Details

### People

The command creates people with:

- Random first and last names
- Various roles: MEMBER, VISITOR, COORDINATOR, PASTOR
- Statuses: ACTIVE, SEMIACTIVE, INACTIVE
- Birth dates between 18-70 years old
- Attendence dates within the last 5 years
- Optional baptism dates
- Random contact information

**Default Password:** `password123` (for all created users)

### Families

- Family names like "The [LastName] Family"
- Each family has a leader (Coordinator or Member)
- 2-5 members per family
- Address and notes

### Clusters

- Cluster names: North, South, East, West, Central, etc.
- Unique cluster codes
- Coordinators assigned
- 1-3 families per cluster
- 3-8 individual members per cluster
- Meeting schedules and locations

### Milestones

- Created for ~50% of people
- Various types: LESSON, BAPTISM, SPIRIT, CLUSTER, NOTE
- Dates within the first year of attendance

### Cluster Weekly Reports

- Reports for the last 4 weeks
- Attendance tracking for members and visitors
- Prayer requests and testimonies
- Financial offerings
- Highlights and lowlights

## Examples

### Start Fresh with Large Dataset

```bash
# Create a large dataset for extensive testing
python manage.py populate_sample_data --clear --people 200 --families 40 --clusters 10
```

### Create Minimal Test Data

```bash
# Create just enough data for basic testing
python manage.py populate_sample_data --people 20 --families 5 --clusters 3
```

### Quick Data Refresh

```bash
# Replace all data with same defaults
python manage.py populate_sample_data --clear
```

## Notes

- The command does NOT delete the `admin` user by default
- People with role='ADMIN' are protected from deletion
- Each run creates unique usernames (e.g., john.smith1, john.smith2)
- Email addresses follow the pattern: username@example.com
- All dates are randomized but realistic

## Troubleshooting

### Import Errors

If you get import errors, make sure the virtual environment is activated:

```bash
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows
```

### Database Migration Errors

Ensure all migrations are applied:

```bash
python manage.py migrate
```

### Too Many Objects Error

If creating large datasets, you may need to increase database limits or process in smaller batches.

## Production Warning

⚠️ **DO NOT run this command in production!** This is for development and testing only.
