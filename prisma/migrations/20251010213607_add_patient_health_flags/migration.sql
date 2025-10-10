-- CreateTable
CREATE TABLE "patient_health_flags" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "flag_key" VARCHAR(50) NOT NULL,
    "flag_value" BOOLEAN NOT NULL,
    "details" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_health_flags_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "patient_health_flags" ADD CONSTRAINT "patient_health_flags_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
