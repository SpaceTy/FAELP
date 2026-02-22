ALTER TABLE material_instances
ADD COLUMN IF NOT EXISTS human_code text;

DO $$
DECLARE
	instance_record record;
	candidate_code text;
BEGIN
	FOR instance_record IN
		SELECT id FROM material_instances
		WHERE human_code IS NULL OR human_code = ''
	LOOP
		LOOP
			SELECT string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ', (floor(random() * 24)::int) + 1, 1), '')
			INTO candidate_code
			FROM generate_series(1, 5);

			EXIT WHEN NOT EXISTS (
				SELECT 1 FROM material_instances WHERE human_code = candidate_code
			);
		END LOOP;

		UPDATE material_instances
		SET human_code = candidate_code
		WHERE id = instance_record.id;
	END LOOP;
END
$$;

ALTER TABLE material_instances
ALTER COLUMN human_code SET NOT NULL;

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'material_instances_human_code_format_check'
	) THEN
		ALTER TABLE material_instances
		ADD CONSTRAINT material_instances_human_code_format_check
		CHECK (human_code ~ '^[A-Z]{5}$');
	END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS material_instances_human_code_key
ON material_instances (human_code);
