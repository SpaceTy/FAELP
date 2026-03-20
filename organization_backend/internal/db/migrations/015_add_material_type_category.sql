ALTER TABLE material_types
  ADD COLUMN IF NOT EXISTS category text;

UPDATE material_types
SET category = CASE
  WHEN category IS NOT NULL AND btrim(category) <> '' THEN category
  WHEN lower(id) LIKE '%dreieckstuch%'
    OR lower(id) LIKE '%fixierbinde%'
    OR lower(id) LIKE '%rettungsdecke%'
    OR lower(id) LIKE '%kompressen%'
    OR lower(id) LIKE '%tourniquet%'
    OR lower(name) LIKE '%dreieckstuch%'
    OR lower(name) LIKE '%fixierbinde%'
    OR lower(name) LIKE '%rettungsdecke%'
    OR lower(name) LIKE '%kompressen%'
    OR lower(name) LIKE '%tourniquet%' THEN 'Wundversorgung&Trauma'
  WHEN lower(id) LIKE '%airway%'
    OR lower(id) LIKE '%matte%'
    OR lower(id) LIKE '%apollo%'
    OR lower(name) LIKE '%airway%'
    OR lower(name) LIKE '%matte%'
    OR lower(name) LIKE '%apollo%' THEN 'Zubehoer'
  ELSE 'Reanimation'
END;

ALTER TABLE material_types
  ALTER COLUMN category SET DEFAULT 'Reanimation';

UPDATE material_types
SET category = 'Reanimation'
WHERE category IS NULL OR btrim(category) = '';

ALTER TABLE material_types
  ALTER COLUMN category SET NOT NULL;

ALTER TABLE material_types
  DROP CONSTRAINT IF EXISTS material_types_category_check,
  ADD CONSTRAINT material_types_category_check
    CHECK (category IN ('Reanimation', 'Wundversorgung&Trauma', 'Zubehoer'));
