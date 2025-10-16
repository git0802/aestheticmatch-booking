-- CreateEnum
CREATE TYPE "AppointmentType" AS ENUM ('first_visit', 'repeat_visit', 'surgical_consult', 'surgery');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('booked', 'completed', 'canceled');

-- CreateTable
CREATE TABLE "appointments" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "practice_id" UUID NOT NULL,
    "appointment_type" "AppointmentType" NOT NULL,
    "status" "AppointmentStatus" NOT NULL,
    "date" TIMESTAMP(6) NOT NULL,
    "is_return_visit" BOOLEAN NOT NULL DEFAULT false,
    "emr_appointment_id" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_practice_id_fkey" FOREIGN KEY ("practice_id") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
