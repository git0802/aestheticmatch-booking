-- AlterTable: add service fields to appointments
ALTER TABLE "appointments"
  ADD COLUMN "service_fee_id" UUID,
  ADD COLUMN "service_name" VARCHAR(255),
  ADD COLUMN "service_type" "ServiceType",
  ADD COLUMN "service_price" DECIMAL(10,2),
  ADD COLUMN "fee_amount" DECIMAL(10,2);

-- AddForeignKey
ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_service_fee_id_fkey"
  FOREIGN KEY ("service_fee_id")
  REFERENCES "service_fees"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
