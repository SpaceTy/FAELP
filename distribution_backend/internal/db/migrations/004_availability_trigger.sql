-- Function to notify when material instance availability changes
CREATE OR REPLACE FUNCTION notify_availability_change()
RETURNS trigger AS $$
BEGIN
  -- Signal that availability has changed for this material type
  PERFORM pg_notify('availability_change_channel', 
    json_build_object(
      'material_type_id', COALESCE(NEW.type_id, OLD.type_id),
      'action', TG_OP,
      'timestamp', now()
    )::text
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger on material_instances table
DROP TRIGGER IF EXISTS material_instances_availability_notify ON material_instances;
CREATE TRIGGER material_instances_availability_notify
AFTER INSERT OR UPDATE OR DELETE ON material_instances
FOR EACH ROW
EXECUTE FUNCTION notify_availability_change();
