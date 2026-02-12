-- Function to notify when material_available changes
CREATE OR REPLACE FUNCTION notify_material_availability_change()
RETURNS trigger AS $$
DECLARE
  payload json;
BEGIN
  payload = json_build_object(
    'material_type_id', COALESCE(NEW.material_type_id, OLD.material_type_id),
    'distribution_center_id', COALESCE(NEW.distribution_center_id, OLD.distribution_center_id),
    'amount', COALESCE(NEW.amount, 0),
    'action', TG_OP,
    'updated_at', now()
  );
  PERFORM pg_notify('material_availability_channel', payload::text);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger on material_available table
DROP TRIGGER IF EXISTS material_available_notify ON material_available;
CREATE TRIGGER material_available_notify
AFTER INSERT OR UPDATE OR DELETE ON material_available
FOR EACH ROW
EXECUTE FUNCTION notify_material_availability_change();
