-- Enforce that appointments.service_fee_id references a service fee belonging to the same practice
-- 1) Ensure composite uniqueness on service_fees(id, practice_id)
DO $$ BEGIN
    ALTER TABLE "service_fees" ADD CONSTRAINT "service_fees_id_practice_id_key" UNIQUE ("id", "practice_id");
EXCEPTION
    WHEN duplicate_table THEN NULL;
    WHEN duplicate_object THEN NULL;
END $$;

-- 2) Replace existing FK on appointments.service_fee_id with composite FK (service_fee_id, practice_id)
DO $$ BEGIN
    ALTER TABLE "appointments" DROP CONSTRAINT IF EXISTS "appointments_service_fee_id_fkey";
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE "appointments"
    ADD CONSTRAINT "appointments_service_fee_composite_fkey"
    FOREIGN KEY ("service_fee_id", "practice_id")
    REFERENCES "service_fees"("id", "practice_id")
    ON UPDATE CASCADE
    ON DELETE RESTRICT;
