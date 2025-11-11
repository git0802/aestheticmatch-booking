-- AlterTable
ALTER TABLE "emr_credentials"
ADD COLUMN IF NOT EXISTS "modmed_provider_id" VARCHAR(50),
ADD COLUMN IF NOT EXISTS "modmed_location_id" VARCHAR(50),
ADD COLUMN IF NOT EXISTS "modmed_appointment_type_id" VARCHAR(50);

-- AlterTable
ALTER TABLE "patients"
ADD COLUMN IF NOT EXISTS "modmed_patient_id" VARCHAR(100);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_patients_modmed_patient_id" ON "patients"("modmed_patient_id");
