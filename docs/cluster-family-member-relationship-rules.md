# Cluster Family-Member Relationship Rules

## Overview

This document outlines the business rules and technical implementation for managing the relationship between families, individual members, and clusters in the Church Management System (CMS). These rules ensure data consistency and prevent conflicts when assigning families and members to clusters.

## Core Principles

### 1. Family-Centric Membership

- **Primary Rule**: When a family is added to a cluster, all family members are automatically added to the cluster
- **Override Protection**: Individual members already assigned to other clusters are not overridden
- **Consistency**: Family membership in a cluster implies all family members belong to that cluster

### 2. Individual Member Override

- **Override Rule**: Individual members can be assigned to clusters independently of their family
- **Priority**: Individual cluster assignments take precedence over family-based assignments
- **Flexibility**: Allows for members to be in different clusters than their family

### 3. Coordinator Safety

- **Validation**: Coordinators must be members of the cluster they coordinate
- **Automatic Cleanup**: If a coordinator is removed from a cluster (via family removal), the coordinator role is automatically unset
- **Prevention**: Prevents orphaned coordinator assignments

## Detailed Rules

### Adding Families to Clusters

#### Rule 1: Automatic Member Addition

```
WHEN: A family is added to a cluster
THEN: All family members are automatically added to the cluster
UNLESS: The member is already assigned to a different cluster
```

**Implementation Logic:**

```typescript
const addFamily = (family: Family) => {
  const familyMembers = family.members || [];
  const existingMembers = cluster.members || [];
  const newMembers = familyMembers.filter(
    (memberId: string) => !existingMembers.includes(memberId)
  );

  return {
    families: [...cluster.families, family.id],
    members: [...existingMembers, ...newMembers],
  };
};
```

#### Rule 2: Override Protection

```
WHEN: A family member is already in a different cluster
THEN: The member remains in their current cluster
AND: The family is still added to the new cluster
BUT: The conflicted member is not added to the new cluster
```

**Example Scenario:**

- Family A has members: John, Jane, Bob
- John is already in Cluster X
- Family A is added to Cluster Y
- Result: Jane and Bob are added to Cluster Y, John remains in Cluster X

### Removing Families from Clusters

#### Rule 3: Complete Member Removal

```
WHEN: A family is removed from a cluster
THEN: All family members are removed from the cluster
UNLESS: The member was individually added to the cluster
```

**Implementation Logic:**

```typescript
const removeFamily = (familyId: string) => {
  const family = families.find((f) => f.id === familyId);
  const familyMembers = family?.members || [];
  const nextMembers = cluster.members.filter(
    (memberId: string) => !familyMembers.includes(memberId)
  );

  return {
    families: cluster.families.filter((id) => id !== familyId),
    members: nextMembers,
  };
};
```

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
THEN: The member is added regardless of family assignments
AND: Family assignments are not affected
```

#### Rule 6: Individual Removal

```
WHEN: An individual member is removed from a cluster
THEN: The member is removed from the cluster
AND: Family assignments remain unchanged
UNLESS: The member was the coordinator
```

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

#### addFamily()

- Adds family to cluster
- Adds all family members to cluster (with override protection)
- Updates member count display

#### removeFamily()

- Removes family from cluster
- Removes all family members from cluster
- Handles coordinator cleanup

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

1. **Family Search**: Search by name or address
2. **Member Search**: Search by name, role, or status
3. **Visual Feedback**: Clear indication of selected items
4. **Member Count**: Show participation level for families

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
3. **Understand Overrides**: Know that individual assignments take precedence
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

