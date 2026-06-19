# Cluster Family-Member Relationship Rules

## Overview

This document outlines the business rules and technical implementation for managing the relationship between families, individual members, and clusters in the Church Management System (CMS). These rules ensure data consistency and prevent conflicts when assigning families and members to clusters.

## Core Principles

### 1. Automatic Family Member Addition

- **Primary Rule**: When a cluster is saved with families assigned, all members of those families are added to the cluster's individual members list.
- **Automatic Behavior**: This runs on the backend during cluster create/update (including when the members field is empty in the form).
- **Existing cluster priority**: If a family member already belongs to a **different** cluster, that membership is kept and they are **not** moved or duplicated into this cluster.
- **Consistency**: Family assignment on a cluster always attempts to include every eligible family member as an individual cluster member.

### 2. Manual Member Removal (UI only until save)

- **Form behavior**: Users can temporarily remove individuals from the members list in the cluster form before saving.
- **On save**: Eligible family members (those not in another cluster) are merged back in from assigned families. Saving with families selected is the source of truth for family-driven membership.
- **Exception**: Members already in another cluster are never pulled in by family assignment (see Rule 1).

### 3. Coordinator Safety

- **Validation**: Coordinators must be members of the cluster they coordinate
- **Automatic Cleanup**: If a coordinator is removed from a cluster (via family removal), the coordinator role is automatically unset
- **Prevention**: Prevents orphaned coordinator assignments

## Detailed Rules

### Adding Families to Clusters

#### Rule 1: Automatic Member Addition on Save

```
WHEN: A cluster is saved with one or more families assigned
THEN: Each member of those families is added to the cluster's members list
UNLESS: That person is already a member of a different cluster (that membership takes priority)
```

**Backend (On Submit):**
`ClusterSerializer` merges the submitted members with eligible family members via `merge_cluster_member_ids()` in `apps/clusters/branch_membership.py`:

```python
def family_members_eligible_for_cluster(cluster, family_member_ids):
    # Exclude anyone already in a different cluster
    blocked = Person.objects.filter(id__in=ids, clusters__isnull=False)
        .exclude(clusters__id=cluster.id)
    return family_member_ids - blocked

def merge_cluster_member_ids(cluster, user_member_ids, family_member_ids):
    return user_member_ids | family_members_eligible_for_cluster(cluster, family_member_ids)
```

**Example Scenario:**

- Family A has members: John, Jane, Bob
- John is already in Cluster X
- Family A is assigned to Cluster Y and the form is saved (even with an empty members list)
- **Result**: Jane and Bob are added to Cluster Y; John stays in Cluster X only

### Removing Families from Clusters

#### Rule 3: Family Removal Behavior

```
WHEN: A family is removed from a cluster (in the form)
THEN: The family is removed from the families list
AND: All family members are automatically removed from the members list (frontend)
NOTE: On backend, family members remain unless explicitly removed via API
```

**Frontend Behavior:**
When a family is removed in the cluster form, all its members are automatically removed from the members list in real-time:

```typescript
const removeFamily = (familyId: string) => {
  setFamilyIds(familyIds.filter((id) => id !== familyId));
  
  // Remove family members when family is removed
  const removedFamily = families.find(f => f.id.toString() === familyId);
  if (removedFamily && removedFamily.members) {
    const familyMemberIds = removedFamily.members.map(id => id.toString());
    setMemberIds(memberIds.filter(id => !familyMemberIds.includes(id)));
  }
};
```

**Backend Behavior:**
When updating via API, removing a family from the families list does NOT automatically remove the family members. This allows for flexibility - family members can remain in the cluster even if the family assignment is removed.

#### Rule 4: Coordinator Cleanup

```
WHEN: A family is removed from a cluster
AND: The coordinator is a member of that family
THEN: The coordinator role is automatically unset
```

**Implementation Logic:**

```typescript
if (familyMembers.includes(cluster.coordinator)) {
  next.coordinator = undefined;
}
```

### Individual Member Management

#### Rule 5: Independent Assignment

```
WHEN: An individual member is added to a cluster
THEN: The member is added to the cluster's members list
AND: Family assignments are not affected
NOTE: This works in addition to family-based member addition
```

#### Rule 6: Manual Member Removal in the Form

```
WHEN: An individual member is removed from the members list in the cluster form
THEN: They are removed from the UI until the form is saved
ON SAVE: Eligible family members from assigned families are merged back in
UNLESS: They are already in another cluster (that cluster keeps them)
```

**Use Case**: The members field may show `0 selected` while families are selected; saving still adds all eligible family members on the backend.

### Coordinator Management

#### Rule 7: Coordinator Validation

```
WHEN: A coordinator is assigned
THEN: The coordinator must be a member of the cluster
```

#### Rule 8: Coordinator Cleanup on Member Removal

```
WHEN: A member is removed from a cluster
AND: The member was the coordinator
THEN: The coordinator role is automatically unset
```

## Visual Indicators

### Family Member Count Display

The system provides visual feedback showing the relationship between families and clusters:

```
Family Name
X/Y members
```

Where:

- **X** = Number of family members currently in the cluster
- **Y** = Total number of members in the family

### Status Indicators

#### Family Status

- **Green Chip**: Family is selected for the cluster
- **Member Count**: Shows participation level (e.g., "3/5 members")
- **Address Badge**: Shows family location if available

#### Member Status

- **Blue Chip**: Individual member is selected for the cluster
- **Role Badge**: Shows member role (Pastor, Coordinator, Member, Visitor)
- **Status Badge**: Shows member status (Active, Semi-active, Inactive, Deceased)

## Conflict Resolution

### Scenario 1: Family Member in Different Cluster

```
SITUATION: Family A is added to Cluster Y, but John (family member) is in Cluster X
RESOLUTION:
- Family A is added to Cluster Y
- Jane and Bob (other family members) are added to Cluster Y
- John remains in Cluster X
- Family A shows "2/3 members" in Cluster Y
```

### Scenario 2: Coordinator Removal via Family

```
SITUATION: Family A is removed from Cluster Y, and John (coordinator) is in Family A
RESOLUTION:
- Family A is removed from Cluster Y
- All family members are removed from Cluster Y
- John's coordinator role is automatically unset
- Cluster Y needs a new coordinator assignment
```

### Scenario 3: Mixed Individual and Family Assignments

```
SITUATION:
- Family A is in Cluster Y
- John (family member) is individually assigned to Cluster X
RESOLUTION:
- Family A remains in Cluster Y
- John remains in Cluster X
- Family A shows reduced member count in Cluster Y
- No conflicts occur
```

## Technical Implementation

### Data Structure

```typescript
interface Cluster {
  id: string;
  name: string;
  families: string[]; // Array of family IDs
  members: string[]; // Array of member IDs
  coordinator?: string; // Member ID of coordinator
}

interface Family {
  id: string;
  name: string;
  members: string[]; // Array of member IDs
  address?: string;
}

interface Person {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  status: string;
}
```

### Key Functions

#### addFamily() (Frontend)

- Adds family to cluster's families list
- Automatically adds all family members to cluster's members list in real-time
- Updates member count display immediately
- Provides instant visual feedback before form submission

#### removeFamily() (Frontend)

- Removes family from cluster's families list
- Automatically removes all family members from cluster's members list in real-time
- Updates member count display immediately

#### addMember()

- Adds individual member to cluster
- Does not affect family assignments

#### removeMember()

- Removes individual member from cluster
- Handles coordinator cleanup
- Does not affect family assignments

#### getFamilyMemberCount()

- Calculates how many family members are in the cluster
- Used for display purposes

## User Interface Guidelines

### Search and Selection

1. **Family Search**: Search by name with real-time dropdown suggestions
2. **Member Search**: Search by name, role, or status with real-time dropdown suggestions
3. **Visual Feedback**: Clear indication of selected items as chips/cards
4. **Real-Time Updates**: When a family is selected, all family members immediately appear in the members field
5. **Automatic Removal**: When a family is removed, all its members are automatically removed from the members list
6. **Member Count**: Shows number of selected members in the label (e.g., "Add Members (5 selected)")

### Display Format

1. **Family Chips**: Green background with member count
2. **Member Chips**: Blue background with role/status badges
3. **Coordinator Selection**: Dropdown limited to cluster members
4. **Conflict Indicators**: Clear messaging for override situations

## Best Practices

### For Administrators

1. **Family-First Approach**: Add families to clusters when possible
2. **Monitor Conflicts**: Watch for family members in different clusters
3. **Coordinator Management**: Ensure coordinators are cluster members
4. **Regular Audits**: Review family-member relationships periodically

### For Users

1. **Search Before Adding**: Use search functionality to find families/members
2. **Check Member Counts**: Verify family participation levels
3. **Understand Overrides**: Existing membership in another cluster takes priority over family assignment
4. **Coordinator Safety**: Be aware that coordinator roles can be auto-unset

## Error Handling

### Validation Rules

1. **Required Fields**: Cluster name is required
2. **Coordinator Validation**: Coordinator must be a cluster member
3. **Duplicate Prevention**: Prevent duplicate family/member assignments
4. **Data Integrity**: Maintain referential integrity

### Error Messages

1. **Family Conflicts**: "Some family members are in other clusters"
2. **Coordinator Issues**: "Coordinator must be a cluster member"
3. **Validation Errors**: "Please fill in required fields"
4. **Network Errors**: "Unable to save changes, please try again"

## Future Considerations

### Potential Enhancements

1. **Bulk Operations**: Add/remove multiple families at once
2. **Conflict Resolution UI**: Visual interface for resolving conflicts
3. **Audit Trail**: Track changes to family-member relationships
4. **Reporting**: Generate reports on cluster composition
5. **Notifications**: Alert when family-member conflicts occur

### Scalability Considerations

1. **Large Families**: Handle families with many members efficiently
2. **Multiple Clusters**: Support members in multiple clusters
3. **Performance**: Optimize queries for large datasets
4. **Caching**: Cache family-member relationships for better performance

---

_This document should be updated as the system evolves and new requirements are identified._

