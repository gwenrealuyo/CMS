# Sunday School Module Guide

## Overview

The Sunday School module manages Sunday School classes, student enrollments, session scheduling, and attendance tracking. Key features include:

- **Category Management**: Organize classes by age-based categories (e.g., Kids Primary 3-7, Teens 12-16) with customizable age ranges
- **Class Management**: Create, edit, delete, and manage Sunday School classes with teachers, meeting times, and room locations
- **Student Enrollment**: Individual and bulk enrollment of students and teachers into classes
- **Session Scheduling**: Schedule individual sessions or create recurring sessions with lesson planning
- **Attendance Tracking**: Integration with the Events module for automatic attendance tracking
- **Analytics & Reports**: Summary statistics, attendance reports, and identification of unenrolled students by category
- **Event Integration**: Sessions automatically create calendar events for attendance tracking
- **Journey Integration**: Attendance for Sunday School sessions creates `SUNDAY_SCHOOL` journeys when marked Present

## Data Model & Storage

### SundaySchoolCategory Model

- `apps.sunday_school.models.SundaySchoolCategory` represents age-based categories with:
  - `name` (string, max 100 chars, unique) – category name (e.g., "Kids Primary", "Teens")
  - `description` (text field, blank) – additional details about the category
  - `min_age` (PositiveSmallInteger, nullable) – minimum age for this category
  - `max_age` (PositiveSmallInteger, nullable) – maximum age for this category
  - `order` (PositiveSmallInteger, default 0) – display order for sorting
  - `is_active` (BooleanField, default True) – whether the category is active
  - `created_at` (DateTimeField, auto_now_add) – when the category was created
  - `updated_at` (DateTimeField, auto_now) – when the category was last updated
- Default ordering: by `order`, then `name`
- Initial categories are populated via data migration (`0002_initial_categories.py`):
  - Kids Primary (3-7)
  - Kids Intermediate (8-11)
  - Teens (12-16)
  - Young Adults (17-22)
  - Young Professionals (23+)

### SundaySchoolClass Model

- `apps.sunday_school.models.SundaySchoolClass` represents a Sunday School class with:
  - `name` (string, max 200 chars) – class name (e.g., "Kids Primary Class A")
  - `category` (ForeignKey to SundaySchoolCategory, PROTECT delete) – the age category this class belongs to
  - `description` (text field, blank) – class description
  - `yearly_theme` (string, max 200 chars, blank) – yearly curriculum theme (e.g., "Growing in Faith 2024")
  - `room_location` (string, max 200 chars, blank) – physical room location (e.g., "Room 101")
  - `meeting_time` (TimeField, nullable) – regular meeting time (e.g., "09:00:00")
  - `is_active` (BooleanField, default True) – whether the class is active
  - `created_at` (DateTimeField, auto_now_add) – when the class was created
  - `updated_at` (DateTimeField, auto_now) – when the class was last updated
- Default ordering: by `category__order`, then `name`
- Related fields:
  - `classes` – reverse relationship from SundaySchoolCategory
  - `members` – reverse relationship from SundaySchoolClassMember
  - `sessions` – reverse relationship from SundaySchoolSession

### SundaySchoolClassMember Model

- `apps.sunday_school.models.SundaySchoolClassMember` links a Person to a Class with:
  - `sunday_school_class` (ForeignKey to SundaySchoolClass, CASCADE delete) – the class
  - `person` (ForeignKey to `people.Person`, CASCADE delete) – the enrolled person
  - `role` (CharField, choices: TEACHER, ASSISTANT_TEACHER, STUDENT) – person's role in the class
  - `enrolled_date` (DateField, default timezone.now) – when the person was enrolled
  - `is_active` (BooleanField, default True) – whether the enrollment is active
  - `notes` (text field, blank) – additional notes about the enrollment
- Unique constraint: `unique_together = ("sunday_school_class", "person")` – prevents duplicate enrollments
- Default ordering: by `sunday_school_class`, `role`, `person__last_name`, `person__first_name`
- Related fields:
  - `sunday_school_memberships` – reverse relationship from Person

### SundaySchoolSession Model

- `apps.sunday_school.models.SundaySchoolSession` represents a class session with:
  - `sunday_school_class` (ForeignKey to SundaySchoolClass, CASCADE delete) – the class this session is for
  - `event` (OneToOneField to `events.Event`, SET_NULL, nullable) – linked calendar event for attendance tracking
  - `session_date` (DateField) – date of the session
  - `session_time` (TimeField, nullable) – time of the session
  - `lesson_title` (string, max 200 chars, blank) – title of the lesson taught
  - `notes` (text field, blank) – additional session notes
  - `is_recurring_instance` (BooleanField, default False) – whether this session was created as part of a recurring series
  - `recurring_group_id` (string, max 100 chars, blank) – identifier for grouping recurring sessions
  - `created_at` (DateTimeField, auto_now_add) – when the session was created
  - `updated_at` (DateTimeField, auto_now) – when the session was last updated
- Default ordering: by `-session_date`, then `-session_time`
- **Event Integration**: When a session is created, it automatically creates a corresponding `Event` of type `SUNDAY_SCHOOL` for attendance tracking. The event is linked via the `event` OneToOneField.

### Cross-App References

All ForeignKey relationships use string references to avoid circular imports:
- `person = models.ForeignKey(settings.AUTH_USER_MODEL, ...)` – references the Person model
- `event = models.OneToOneField("events.Event", ...)` – references the Event model

### Migrations

- `apps.sunday_school.migrations.0001_initial` – Creates all Sunday School tables with relationships
- `apps.sunday_school.migrations.0002_initial_categories` – Populates initial categories with age brackets

## API Surface

All routes live under `/api/sunday-school/` (namespaced in `core.urls`):

### Categories

- `/api/sunday-school/categories/` – SundaySchoolCategoryViewSet CRUD
  - `GET` – List all categories
    - Query params: `?is_active=true` – filter by active status
    - Query params: `?search={term}` – search by name or description
    - Query params: `?ordering={field}` – order by order, name, or created_at
  - `POST` – Create a new category (requires `name`, optional `min_age`, `max_age`, `order`, `is_active`)
  - `GET /{id}/` – Retrieve a specific category
  - `PUT /{id}/` – Update a category (full update)
  - `PATCH /{id}/` – Partial update
  - `DELETE /{id}/` – Delete a category (PROTECT if classes exist)

### Classes

- `/api/sunday-school/classes/` – SundaySchoolClassViewSet CRUD
  - `GET` – List all classes
    - Query params: `?category={category_id}` – filter by category
    - Query params: `?is_active=true` – filter by active status
    - Query params: `?search={term}` – search by name or description
  - `POST` – Create a new class (requires `name`, `category`, optional `description`, `yearly_theme`, `room_location`, `meeting_time`)
  - `GET /{id}/` – Retrieve a specific class with nested members and category
  - `PUT /{id}/` – Update a class (full update)
  - `PATCH /{id}/` – Partial update
  - `DELETE /{id}/` – Delete a class (cascades to members and sessions)
- `/api/sunday-school/classes/{id}/enroll/` – `POST` action for bulk enrollment
  - Payload: `{ "person_ids": [1, 2, 3], "role": "STUDENT" }`
  - Enrolls multiple people at once with the specified role
- `/api/sunday-school/classes/{id}/sessions/` – `GET` action to list sessions for a class
  - Query params: `?start_date={date}`, `?end_date={date}` – filter by date range
- `/api/sunday-school/classes/{id}/attendance/` – `GET` action to get attendance data for a class
  - Query params: `?start_date={date}`, `?end_date={date}` – filter by date range
- `/api/sunday-school/classes/summary/` – `GET` action returning summary statistics
  - Returns: `total_classes`, `total_students`, `total_teachers`, `total_sessions`, `attendance_rate`
- `/api/sunday-school/classes/unenrolled_by_category/` – `GET` action returning unenrolled students by category
  - Query params: `?status={status}` – filter by person status (e.g., "ACTIVE")
  - Query params: `?role={role}` – filter by person role (e.g., "MEMBER")
  - Returns: List of categories with unenrolled people matching age ranges, including cluster and family information

### Members

- `/api/sunday-school/members/` – SundaySchoolClassMemberViewSet CRUD
  - `GET` – List all class members
    - Query params: `?class={class_id}` – filter by class
    - Query params: `?person={person_id}` – filter by person
    - Query params: `?role={role}` – filter by role (TEACHER, ASSISTANT_TEACHER, STUDENT)
    - Query params: `?is_active=true` – filter by active status
  - `POST` – Create a new enrollment (requires `sunday_school_class_id`, `person_id`, `role`)
  - `GET /{id}/` – Retrieve a specific enrollment
  - `PUT /{id}/` – Update an enrollment (full update)
  - `PATCH /{id}/` – Partial update
  - `DELETE /{id}/` – Delete an enrollment

### Sessions

- `/api/sunday-school/sessions/` – SundaySchoolSessionViewSet CRUD
  - `GET` – List all sessions
    - Query params: `?class={class_id}` – filter by class
    - Query params: `?start_date={date}`, `?end_date={date}` – filter by date range
  - `POST` – Create a new session (requires `sunday_school_class_id`, `session_date`, optional `session_time`, `lesson_title`, `notes`)
    - **Automatic Event Creation**: When a session is created, it automatically creates a corresponding `Event` of type `SUNDAY_SCHOOL` for attendance tracking
  - `GET /{id}/` – Retrieve a specific session with nested class and event information
  - `PUT /{id}/` – Update a session (full update)
    - **Event Synchronization**: When a session is updated, the linked event is also updated if it exists
  - `PATCH /{id}/` – Partial update
  - `DELETE /{id}/` – Delete a session (sets event to NULL, doesn't delete the event)
- `/api/sunday-school/sessions/{id}/attendance_report/` – `GET` action returning attendance report for a session
  - Returns: `session_id`, `session_date`, `lesson_title`, `total_enrolled`, `present_count`, `absent_count`, `excused_count`, `attendance_rate`
- `/api/sunday-school/sessions/create_recurring/` – `POST` action for creating recurring sessions
  - Payload: `{ "sunday_school_class_id": 1, "start_date": "2024-01-07", "end_date": "2024-11-03", "session_time": "09:00:00", "lesson_title": "Weekly Lesson" }`
  - Creates multiple sessions between start_date and end_date for Sundays only
  - Each session automatically creates a corresponding Event
  - Returns: `{ "created": 45, "sessions": [...] }`

### Serializers

Serializers (`apps.sunday_school.serializers`) expose:

- `SundaySchoolCategorySerializer`:
  - `age_range_display` – computed property showing age range (e.g., "3-7", "23+")
  - All category fields

- `SundaySchoolClassSerializer`:
  - `category` – nested category object (read-only)
  - `category_id` – write-only field for setting category
  - `teacher` – nested person object for primary teacher (read-only, from members with role=TEACHER)
  - `assistant_teachers` – list of assistant teachers (read-only, from members with role=ASSISTANT_TEACHER)
  - `students_count` – computed count of active students
  - `teachers_count` – computed count of active teachers
  - All class fields

- `SundaySchoolClassMemberSerializer`:
  - `person` – nested person object with full name formatting (read-only)
  - `person_id` – write-only field for setting person
  - `role_display` – human-readable role name (read-only)
  - All member fields

- `SundaySchoolSessionSerializer`:
  - `sunday_school_class` – nested class object (read-only)
  - `sunday_school_class_id` – write-only field for setting class
  - `event_id` – read-only event ID if event exists
  - All session fields

- `SundaySchoolSummarySerializer`:
  - Summary statistics: `total_classes`, `total_students`, `total_teachers`, `total_sessions`, `attendance_rate`

- `SundaySchoolAttendanceReportSerializer`:
  - Attendance report: `session_id`, `session_date`, `lesson_title`, `total_enrolled`, `present_count`, `absent_count`, `excused_count`, `attendance_rate`

- `SundaySchoolUnenrolledByCategorySerializer`:
  - Category information with list of unenrolled people matching age ranges
  - Includes person details with cluster and family information

## Frontend Behavior

The Sunday School hub lives at `frontend/src/app/sunday-school/page.tsx` and provides comprehensive management of classes, enrollments, and sessions.

### Main Page Features

- **Class Listing**: Table view of all classes with:
  - Class name, category, description
  - Teacher information
  - Student/teacher counts
  - Active status
  - Actions (View, Edit, Delete)
- **Search & Filters**:
  - Debounced search by class name or description (automatic after 300ms delay)
  - Filter by category (dropdown)
  - Filter by active status (All, Active, Inactive)
- **Summary Dashboard**: Cards showing:
  - Total classes
  - Total students
  - Total teachers
  - Total sessions
  - Overall attendance rate
- **Unenrolled Students Analytics**: Expandable cards showing unenrolled students by category with:
  - Category name and age range
  - Count of unenrolled students
  - Expandable table with student details (name, age, cluster, family, status)
  - Bulk enroll functionality per category

### Components Overview

- **`SundaySchoolClassForm`**: Form for creating/editing classes
  - Category selection with auto-fill of class name (without age range)
  - Time input with 30-minute interval dropdown
  - Placeholders for all input fields
  - Button styling matches cluster form (`flex-1`, `gap-4`)

- **`CategoryManagement`**: Component for managing categories
  - List of categories with age ranges
  - Create, edit, delete categories
  - Reorder categories

- **`ClassMembersSection`**: Section displaying and managing class members
  - Table of enrolled members with role, enrollment date, status
  - Add member button
  - Bulk enroll button
  - Remove member functionality

- **`BulkEnrollModal`**: Modal for bulk enrolling students
  - Search-based person selection (debounced, 300ms delay)
  - Role selection (Student, Teacher, Assistant Teacher)
  - Checkbox selection with "Select Visible" / "Deselect Visible"
  - Displays "Start typing to search for people..." when search is empty
  - Scalable: only fetches people when searching, doesn't load all people upfront

- **`ClassSessionsSection`**: Section displaying and managing class sessions
  - Table of sessions with date, time, lesson title, event link
  - Add Session button
  - Create Recurring button
  - View, Edit, Attendance actions per session

- **`SessionForm`**: Form for creating/editing individual sessions
  - Date picker
  - Time input with 30-minute interval dropdown
  - Lesson title input
  - Notes textarea with placeholder

- **`RecurringSessionForm`**: Form for creating recurring sessions
  - Start date picker
  - End date picker (defaults to first Sunday of November of current year)
  - Time input with 30-minute interval dropdown
  - Lesson title input
  - Creates sessions for all Sundays between start and end dates

- **`SessionView`**: Read-only view of session details
  - Session information (date, time, lesson title, notes)
  - Class name
  - Event link (if available)
  - Quick attendance summary with:
    - Total enrolled, present, absent, excused counts
    - Attendance rate with progress bar
  - Action buttons: Edit, View Attendance, Close

- **`AttendanceReport`**: Component displaying attendance report
  - Statistics cards (total enrolled, present, absent, excused)
  - Attendance rate with progress bar
  - Session date and lesson title

- **`UnenrolledByCategory`**: Component displaying unenrolled students by category
  - Expandable cards per category
  - Table with columns: Name, Age, Cluster, Family, Status
  - Bulk enroll button per category

- **`SundaySchoolSummary`**: Component displaying summary statistics
  - Cards for total classes, students, teachers, sessions
  - Overall attendance rate

### Class Detail Modal

When viewing a class, a modal displays:
- **Class Information**: Category, description, yearly theme, room location, meeting time
- **Members Section**: List of enrolled members with management options
- **Sessions Section**: List of sessions with scheduling options
- **Footer Actions**:
  - Delete button (left, red icon)
  - Close button (right)
  - Edit button (right, blue)

### Data Loading & Updates

- On mount, the page fetches categories, classes, summary, and unenrolled data in parallel
- Successful form submissions refresh relevant data
- Errors surface via error messages
- Loading states are managed per data type
- Debounced search prevents excessive API calls
- Optimistic UI updates where appropriate

### Time Input Handling

- All time inputs use dropdowns with 30-minute intervals (6:00 AM to 11:30 PM)
- Times are displayed in 12-hour format with AM/PM
- Backend stores times in 24-hour format

### Event Integration

- When a session is created, it automatically creates a corresponding `Event` of type `SUNDAY_SCHOOL`
- The event appears on the calendar and can be used for attendance tracking
- Session view includes a link to the event on the calendar
- Attendance reports use the event's attendance records

## Integration with Events & Attendance

The Sunday School module integrates with the Events and Attendance modules:

1. **Automatic Event Creation**: When a `SundaySchoolSession` is created, it automatically creates a corresponding `Event` of type `SUNDAY_SCHOOL` with:
   - Title: Class name
   - Description: Lesson title (if provided)
   - Start/End datetime: Based on session_date and session_time
   - Type: `SUNDAY_SCHOOL`
   - Location: Class room_location (if provided)

2. **Event Synchronization**: When a session is updated, the linked event is also updated to reflect changes in date, time, or lesson title.

3. **Attendance Tracking**: Attendance is tracked through the Events module:
   - Each session's linked event can have attendance records
   - Attendance reports aggregate data from the event's attendance records
   - The attendance rate is calculated based on enrolled students vs. present students

4. **Event Link**: Sessions display a "View Event" link that opens the event in the calendar view.

## Django Admin

All Sunday School models are registered in Django admin (`apps.sunday_school.admin`):

- **SundaySchoolCategoryAdmin**:
  - List display: name, min_age, max_age, order, is_active
  - Filterable by is_active
  - Searchable by name

- **SundaySchoolClassAdmin**:
  - List display: name, category, teacher, room_location, meeting_time, is_active
  - Filterable by category, is_active
  - Searchable by name, description, room_location, teacher name
  - Raw ID fields for teacher and assistant_teachers

- **SundaySchoolClassMemberAdmin**:
  - List display: sunday_school_class, person, role, enrollment_date, is_active
  - Filterable by role, is_active, category
  - Searchable by class name, person name
  - Raw ID fields for person and class

- **SundaySchoolSessionAdmin**:
  - List display: sunday_school_class, session_date, session_time, lesson_title, event
  - Filterable by category, session_date
  - Searchable by class name, lesson_title
  - Raw ID fields for class and event

## Testing

- `apps.sunday_school.tests` should include coverage for:
  - Category CRUD operations
  - Class CRUD operations
  - Member enrollment (individual and bulk)
  - Session CRUD operations
  - Recurring session creation
  - Attendance report generation
  - Summary statistics calculation
  - Unenrolled by category calculation
  - Event creation and synchronization
  - Age calculation for category matching
  - Unique constraint on class-person enrollment

Run tests with SQLite settings to avoid Postgres permissions:

```bash
cd backend
source venv/bin/activate
python manage.py test apps.sunday_school --settings=core.settings_test
```

Extend the suite with fixtures covering classes with various member configurations, recurring sessions, attendance scenarios, and edge cases (empty classes, 100% attendance, overlapping age ranges, etc.) so the module remains trustworthy.

## Future Enhancements

The following features and improvements are planned for future development:

### 1. Year Filtering for Classes and Sessions

**Status**: Planned - See `docs/PLAN_YEAR_FILTERING_SUNDAY_SCHOOL.md`

- Filter classes and sessions by academic/school year
- Default view to current year
- Year selector in class listing and session views
- Historical data access by year
- Year-based analytics and reporting

### 2. Student Attendance History and Insights

- **Individual Student Attendance History**: Complete attendance timeline for each student across all sessions
- **Attendance Patterns**: Identify attendance trends, streaks, and patterns
- **Frequently Absent Students**: Dashboard highlighting students with low attendance rates
- **Engagement Scores**: Calculate and display student engagement scores based on attendance patterns
- **Attendance Charts**: Visual charts showing attendance trends over time (monthly, quarterly, yearly)

### 3. Advanced Analytics and Reporting

- **Class Comparison**: Compare attendance rates and engagement across different classes
- **Category Analytics**: Aggregate statistics by category (e.g., all Kids Primary classes)
- **Teacher Performance Metrics**: Track and compare teacher effectiveness based on attendance and engagement
- **Seasonal Trends**: Identify attendance patterns by season, month, or special events
- **Export Functionality**: Export reports to Excel, PDF, or CSV formats
- **Custom Date Range Reports**: Generate reports for any date range with detailed breakdowns

### 4. Lesson Planning Enhancements

- **Curriculum Management**: Full curriculum tracking with lesson sequences and materials
- **Lesson Library**: Repository of lesson plans that can be reused across classes
- **Lesson Materials**: Attach files, links, or resources to lessons
- **Lesson Progress Tracking**: Track which lessons have been taught and when
- **Lesson Completion Status**: Mark lessons as completed with notes and feedback

### 5. Student Progress and Development

- **Student Notes**: Teachers can add notes and observations about individual students
- **Progress Tracking**: Track student growth and development over time
- **Journey Integration**: Automatic journey creation for student achievements (e.g., "Completed 10 sessions")
- **Student Profiles**: Comprehensive view of each student's Sunday School journey
- **Parent/Guardian Portal**: Allow parents to view their child's attendance and progress

### 6. Class Management Improvements

- **Class Capacity Limits**: Set maximum enrollment limits for classes
- **Waitlist Management**: Manage waiting lists when classes are full
- **Student Promotion**: Automatically promote students to next category/class based on age or completion
- **Class Rosters**: Export class rosters with contact information
- **Teacher Assignment**: Enhanced teacher assignment with role-based permissions
- **Substitute Teacher Management**: Track and manage substitute teachers

### 7. Notifications and Reminders

- **Session Reminders**: Send reminders to teachers and students before sessions
- **Absence Notifications**: Notify teachers when students are frequently absent
- **Enrollment Notifications**: Notify parents/guardians when students are enrolled
- **Event Reminders**: Integration with calendar reminders for upcoming sessions
- **Bulk Notifications**: Send announcements to entire classes or categories

### 8. Bulk Operations

- **Bulk Session Management**: Edit or delete multiple sessions at once
- **Bulk Enrollment Updates**: Update enrollment status for multiple students
- **Bulk Session Creation**: Enhanced recurring session creation with more options
- **Bulk Attendance Entry**: Quick attendance entry for multiple sessions

### 9. Integration Enhancements

- **Lessons Module Integration**: Link Sunday School lessons to the Lessons module
- **Journey Auto-Creation**: Automatically create journeys for attendance achievements
- **Finance Integration**: Track offerings or fees collected during Sunday School sessions
- **People Module Deep Integration**: Enhanced student profiles with Sunday School history
- **Calendar Enhancements**: Better calendar integration with color-coding and filtering

### 10. UI/UX Improvements

- **Dashboard Widgets**: Quick stats widgets on main dashboard
- **Mobile Responsiveness**: Enhanced mobile experience for teachers on-the-go
- **Keyboard Shortcuts**: Power user shortcuts for common operations
- **Drag-and-Drop**: Reorder categories, classes, or sessions via drag-and-drop
- **Quick Actions**: Context menus and quick action buttons throughout the interface
- **Advanced Search**: Full-text search across all Sunday School data

### 11. Data Management

- **Data Import**: Import student data from CSV or Excel files
- **Data Export**: Comprehensive export options for all Sunday School data
- **Backup and Restore**: Backup Sunday School data with restore functionality
- **Data Archiving**: Archive old classes and sessions while preserving history
- **Audit Logging**: Track all changes to classes, enrollments, and sessions

### 12. Advanced Features

- **Multi-Location Support**: Support for multiple church locations/branches
- **Class Templates**: Create class templates for quick setup
- **Recurring Enrollment**: Automatically enroll new members based on age or other criteria
- **Attendance Predictions**: ML-based predictions for likely attendance
- **Resource Management**: Track and manage classroom resources and materials
- **Volunteer Management**: Enhanced volunteer/teacher scheduling and management

