# Automatic Journey Creation for Person Date Fields

## Overview
When a Person's date fields are set, automatically create Journey entries. Delete the journey if the date is cleared.

Supported fields:
- `water_baptism_date` → Journey type "BAPTISM"
- `spirit_baptism_date` → Journey type "SPIRIT"
- `date_first_attended` → Journey type "NOTE"

## Journey Title Requirements

- **Water Baptism** (`water_baptism_date`): `"Baptized in Jesus' name"`
- **Spirit Baptism** (`spirit_baptism_date`): `"Received the Holy Ghost"`
- **First Attended** (`date_first_attended`): `"First Attended"`

Note: The date will be stored in the Journey's `date` field and displayed separately, so it's not included in the title.

## Implementation Details

### 1. Signal Handler in `backend/apps/people/signals.py`

Add a `post_save` signal receiver for the Person model that:
- Detects changes to `water_baptism_date`, `spirit_baptism_date`, and `date_first_attended` fields
- Also detects changes to `first_activity_attended` (to update the journey description)
- Creates/updates Journey entries when dates are set
- Deletes Journey entries when dates are cleared (set to None)

**Key logic:**
- Track previous values using `pre_save` signal or by checking database before save
- Compare old vs new values to detect changes
- For each date field:
  - If date is set (changed from None to date, or date changed): Create or update Journey with appropriate type
  - If date is cleared (changed from date to None): Delete the corresponding Journey entry
- For `date_first_attended`: Include `first_activity_attended` in the description if available
- For `first_activity_attended`: If `date_first_attended` exists and `first_activity_attended` changes, update the existing journey description
- Check for existing journeys to avoid duplicates (match by user, type)

### 2. Implementation Pattern

Following the existing pattern from `backend/apps/attendance/signals.py`:
- Use `@receiver(post_save, sender=Person)` decorator
- Use `@receiver(pre_save, sender=Person)` to track previous values
- Handle both creation and updates
- Include error handling and logging

### 3. Journey Entry Details

For **water_baptism_date**:
- **Type**: "BAPTISM"
- **Date**: Use the `water_baptism_date` value
- **Title**: `"Baptized in Jesus' name"`
- **Description**: Optional descriptive text (e.g., "Water baptism")
- **User**: The Person instance
- **Verified by**: None (system-generated)

For **spirit_baptism_date**:
- **Type**: "SPIRIT"
- **Date**: Use the `spirit_baptism_date` value
- **Title**: `"Received the Holy Ghost"`
- **Description**: Optional descriptive text (e.g., "Spirit baptism")
- **User**: The Person instance
- **Verified by**: None (system-generated)

For **date_first_attended**:
- **Type**: "NOTE"
- **Date**: Use the `date_first_attended` value
- **Title**: `"First Attended"`
- **Description**: Include `first_activity_attended` if available (e.g., "First attendance: Sunday Service" or "First attendance: Cluster/BS Evangelism"). If `first_activity_attended` is not set, use generic text (e.g., "First attendance")
- **User**: The Person instance
- **Verified by**: None (system-generated)
- **Note**: When `first_activity_attended` changes, update the journey description if the journey already exists (i.e., `date_first_attended` is still set)

### 4. Edge Cases to Handle

- Person created with date fields already set
- Date changed from one date to another (update existing journey)
- Date cleared (set to None) - delete journey
- Multiple saves without field changes (avoid duplicate journeys)
- All three dates set independently (should create three separate journeys)
- Bulk updates (may not trigger signals - document limitation)

## Files to Modify

1. **`backend/apps/people/signals.py`**
   - Add `pre_save` signal to track previous values
   - Add `post_save` signal handler for Person model
   - Import Journey model
   - Implement logic to create/update/delete journeys based on date fields (water_baptism_date, spirit_baptism_date, date_first_attended)
   - Include `first_activity_attended` in journey description for `date_first_attended` journeys
   - Handle updates to `first_activity_attended` to update existing journey descriptions

## Implementation Approach

1. Use `pre_save` signal to store original values in instance (e.g., `_original_water_baptism_date`, `_original_spirit_baptism_date`, `_original_date_first_attended`, `_original_first_activity_attended`)
2. In `post_save`, compare original vs current values
3. For each date field:
   - If date was added/changed: Create or update journey (for `date_first_attended`, include `first_activity_attended` in description if available)
   - If date was cleared: Delete journey if exists
4. For `first_activity_attended`:
   - If changed and `date_first_attended` is set: Update the existing journey description
5. Use the date directly for the Journey's `date` field (no formatting needed in title)
6. Format `first_activity_attended` using `get_first_activity_attended_display()` to get the human-readable label

## Testing Considerations

- Test creating Person with date fields already set (including `first_activity_attended` with `date_first_attended`)
- Test updating Person to add each date field
- Test updating Person to change each date field
- Test updating `first_activity_attended` when `date_first_attended` is set (should update journey description)
- Test clearing each date field (should delete corresponding journey)
- Test that existing journeys are updated, not duplicated
- Test all three date fields independently
- Test setting multiple dates on same person
- Test updating one date while others remain unchanged
- Test journey creation with `date_first_attended` set but `first_activity_attended` not set (should still create journey)

## Notes

- Signals are already registered in `backend/apps/people/apps.py` via `ready()` method
- This follows the same pattern as attendance journey creation in `backend/apps/attendance/signals.py`
- The implementation will work for both API updates and admin panel updates
