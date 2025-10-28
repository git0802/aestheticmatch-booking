-- RenameForeignKey
ALTER TABLE "appointments" RENAME CONSTRAINT "appointments_service_fee_composite_fkey" TO "appointments_service_fee_id_practice_id_fkey";
