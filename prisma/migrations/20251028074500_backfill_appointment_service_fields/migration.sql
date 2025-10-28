-- Backfill Appointment service fields and fee amounts based on linked ServiceFee and FeeSettings
-- Idempotent where possible: only updates rows missing values

-- 1) Populate service_name, service_type, service_price from service_fees when service_fee_id is set
UPDATE "appointments" a
SET
  "service_name" = sf."service_name",
  "service_type" = sf."service_type",
  "service_price" = sf."price"
FROM "service_fees" sf
WHERE a."service_fee_id" = sf."id"
  AND (
    a."service_name" IS NULL OR
    a."service_type" IS NULL OR
    a."service_price" IS NULL
  );

-- 2) Populate fee_amount from global fee_settings when missing
--    Uses the most recently updated FeeSettings row if multiple exist
UPDATE "appointments" a
SET
  "fee_amount" = CASE a."service_type"
    WHEN 'consult' THEN (
      SELECT fs."consultFee"
      FROM "fee_settings" fs
      ORDER BY fs."updated_at" DESC, fs."created_at" DESC
      LIMIT 1
    )
    WHEN 'surgery' THEN (
      SELECT fs."surgeryFee"
      FROM "fee_settings" fs
      ORDER BY fs."updated_at" DESC, fs."created_at" DESC
      LIMIT 1
    )
    WHEN 'non_surgical' THEN (
      SELECT fs."nonSurgicalFee"
      FROM "fee_settings" fs
      ORDER BY fs."updated_at" DESC, fs."created_at" DESC
      LIMIT 1
    )
    ELSE a."fee_amount"
  END
WHERE a."service_fee_id" IS NOT NULL
  AND a."fee_amount" IS NULL
  AND a."service_type" IS NOT NULL;

-- 3) Ensure mode is set (column is NOT NULL with default, so this is a no-op unless legacy data exists)
UPDATE "appointments" a
SET "mode" = 'in_person'
WHERE a."mode" IS NULL;