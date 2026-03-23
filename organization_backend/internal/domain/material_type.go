package domain

type MaterialCategory string

const (
	MaterialCategoryReanimation        MaterialCategory = "Reanimation"
	MaterialCategoryWoundCareAndTrauma MaterialCategory = "Wundversorgung&Trauma"
	MaterialCategoryAccessories        MaterialCategory = "Zubehoer"
)

func (c MaterialCategory) IsValid() bool {
	switch c {
	case MaterialCategoryReanimation, MaterialCategoryWoundCareAndTrauma, MaterialCategoryAccessories:
		return true
	default:
		return false
	}
}

// MaterialType represents a type of material that can be requested
type MaterialType struct {
	ID             string           `json:"id"`
	Name           string           `json:"name"`
	Description    string           `json:"description"`
	ImageURL       string           `json:"imageUrl"`
	Category       MaterialCategory `json:"category"`
	AvailableCount int              `json:"availableCount"`
}

// CreateMaterialTypeInput contains fields for creating a new material type
type CreateMaterialTypeInput struct {
	Name        string           `json:"name"`
	Description string           `json:"description"`
	Category    MaterialCategory `json:"category"`
}

// UpdateMaterialTypeInput contains fields for updating a material type
type UpdateMaterialTypeInput struct {
	Name        string           `json:"name"`
	Description string           `json:"description"`
	Category    MaterialCategory `json:"category"`
}
