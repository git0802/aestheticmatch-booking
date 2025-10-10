-- CreateEnum
CREATE TYPE "AllergySeverity" AS ENUM ('mild', 'moderate', 'severe');

-- CreateTable
CREATE TABLE "patient_allergies" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "allergy_name" VARCHAR(100) NOT NULL,
    "severity" "AllergySeverity" NOT NULL DEFAULT 'mild',
    "details" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_allergies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_medications" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "medication_name" VARCHAR(100) NOT NULL,
    "dosage" VARCHAR(50),
    "frequency" VARCHAR(50),
    "details" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_medications_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "patient_allergies" ADD CONSTRAINT "patient_allergies_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_medications" ADD CONSTRAINT "patient_medications_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
