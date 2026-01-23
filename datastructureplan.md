# Material Type
{
  id: string,              // "manikin-adult-001"
  name: string,            // "Adult CPR Manikin"
  description: string,
  imageUrl: string,
}

# Material Instance
{
  id: string,              // Unique serial number
  typeId: string,          // References MaterialType
  status: "available" | "rented" | "returned",
  useCount: number,
  location: string,  // address of current location
  currentAssignment: {
    requestId: string | null,
  },
}

# Request
{
  id: string,
  customer: customer,
  items: Map<MaterialType, int>
  deliveryDate: Date,
  status: "pending" | "inAction" | "returned",
  shippingAddress: {
    customerName: string,
    addressLine1: string,
    addressLine2: string | null,
    city: string,
    zipCode: string,
  }
  createdAt: Date,
  updatedAt: Date,
}

# Customer
{
  id: string,
  email: string,
  name: string,
  token: string,
  createdAt: Date,
}
