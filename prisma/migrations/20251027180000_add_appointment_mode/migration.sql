-- Add AppointmentMode enum and mode column to appointments
DO $$ BEGIN
    CREATE TYPE "AppointmentMode" AS ENUM ('virtual', 'in_person');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "appointments"
    ADD COLUMN IF NOT EXISTS "mode" "AppointmentMode" NOT NULL DEFAULT 'in_person';
