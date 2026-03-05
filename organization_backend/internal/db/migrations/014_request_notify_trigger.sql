-- Function to notify when requests change
CREATE OR REPLACE FUNCTION notify_request_change()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('request_change_channel',
    json_build_object(
      'request_id', COALESCE(NEW.id, OLD.id),
      'customer_id', COALESCE(NEW.customer_id, OLD.customer_id),
      'status', COALESCE(NEW.status, OLD.status),
      'action', TG_OP
    )::text
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS requests_notify ON requests;
CREATE TRIGGER requests_notify
AFTER INSERT OR UPDATE OR DELETE ON requests
FOR EACH ROW EXECUTE FUNCTION notify_request_change();
