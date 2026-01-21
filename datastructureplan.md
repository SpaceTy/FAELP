# Material Type
{
  id: string,              // "manikin-adult-001"
  name: string,            // "Adult CPR Manikin"
  category: string,        // "training-equipment"
  description: string,
  imageUrl: string,
  requiresCertification: boolean,
  maxUsesBeforeReplace: number,
  cleaningRequired: boolean,
  replacementParts: string[]
}

# Material Instance
{
  id: string,              // Unique serial number
  typeId: string,          // References MaterialType
  status: "available" | "reserved" | "rented" | "maintenance" | "retired",
  condition: "excellent" | "good" | "fair" | "poor",
  useCount: number,
  lastCleaned: Date,
  warehouseLocation: string,  // "BER-01-A3" (Berlin warehouse, aisle 1, shelf A3)
  currentAssignment: {
    requestId: string | null,
    schoolId: string | null,
    assignedDate: Date | null
  },
  purchaseDate: Date,
  notes: string[]          // Specific item history
}

# Request
{
  id: string,
  user: user,
  items: Map<MaterialType, int>
  deliveryDate: Date,
  status: "pending" | "approved" | "rejected" | "prepared" | "shipped" | "delivered" | "returned" | "archived" | "cancelled",
  shippingAddress: {
    schoolName: string,
    addressLine1: string,
    addressLine2: string | null,
    city: string,
    zipCode: string,
  }
  createdAt: Date,
  updatedAt: Date,
  notes: string[]
}

# User
{
  id: string,
  email: string,
  name: string,
  token: string,
  createdAt: Date,
  updatedAt: Date,
  notes: string[]
}
