# Fix Plan: Filter Unknown Material Types in Organization Backend

## Problem
The `material_available` table in organization_backend has a foreign key constraint on `material_type_id` that references `material_types(id)`. When distribution_backend reports availability for material types that don't exist in organization_backend's `material_types` table, the insert fails with:

```
pq: insert or update on table "material_available" violates foreign key constraint "material_available_material_type_id_fkey"
```

## Solution
Modify the `UpdateMaterialAvailability` function in organization_backend to filter out unknown material type IDs before inserting into `material_available`.

## Implementation

### File: `organization_backend/internal/db/queries.go`

Modify the `UpdateMaterialAvailability` function (lines 598-626) to:
1. First, query which material type IDs exist in the `material_types` table
2. Filter the incoming availability map to only include known material types
3. Insert only the filtered records

### Code Change

```go
// UpdateMaterialAvailability updates the availability count for a distribution center
// Only material types that exist in material_types table will be stored
func (s *Store) UpdateMaterialAvailability(ctx context.Context, distributionCenterID string, availability map[string]int) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Delete existing availability for this distribution center
	_, err = tx.ExecContext(ctx, `
		DELETE FROM material_available
		WHERE distribution_center_id = $1
	`, distributionCenterID)
	if err != nil {
		return err
	}

	// Get list of valid material type IDs from material_types table
	rows, err := tx.QueryContext(ctx, `SELECT id FROM material_types`)
	if err != nil {
		return err
	}
	defer rows.Close()

	validTypeIDs := make(map[string]bool)
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return err
		}
		validTypeIDs[id] = true
	}
	if err := rows.Err(); err != nil {
		return err
	}

	// Insert new availability records only for known material types
	for materialTypeID, amount := range availability {
		if !validTypeIDs[materialTypeID] {
			// Skip unknown material types
			continue
		}
		_, err = tx.ExecContext(ctx, `
			INSERT INTO material_available (material_type_id, distribution_center_id, amount)
			VALUES ($1, $2, $3)
		`, materialTypeID, distributionCenterID, amount)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}
```

## Testing
1. Create a material instance in distribution_backend with a `type_id` that doesn't exist in organization_backend
2. Trigger the availability sync by calling the material types endpoint
3. Verify no error is logged and only valid material types are stored

## Files Changed
- `organization_backend/internal/db/queries.go` - Modify `UpdateMaterialAvailability` function
