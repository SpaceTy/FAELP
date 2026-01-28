-- Create material_types table
CREATE TABLE IF NOT EXISTS material_types (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  image_url text NOT NULL
);

-- Add foreign key constraint to request_items referencing material_types
ALTER TABLE request_items
  DROP CONSTRAINT IF EXISTS request_items_material_type_id_fkey,
  ADD CONSTRAINT request_items_material_type_id_fkey
    FOREIGN KEY (material_type_id) REFERENCES material_types(id) ON DELETE RESTRICT;

-- Add foreign key constraint to material_available referencing material_types
ALTER TABLE material_available
  DROP CONSTRAINT IF EXISTS material_available_material_type_id_fkey,
  ADD CONSTRAINT material_available_material_type_id_fkey
    FOREIGN KEY (material_type_id) REFERENCES material_types(id) ON DELETE CASCADE;

-- Index for faster material type lookups
CREATE INDEX IF NOT EXISTS material_types_name_idx ON material_types(name);
