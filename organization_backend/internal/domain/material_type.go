package domain

// MaterialType represents a type of material that can be requested
type MaterialType struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	Description    string `json:"description"`
	ImageURL       string `json:"imageUrl"`
	AvailableCount int    `json:"availableCount"`
}

// CreateMaterialTypeInput contains fields for creating a new material type
type CreateMaterialTypeInput struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

// UpdateMaterialTypeInput contains fields for updating a material type
type UpdateMaterialTypeInput struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}
