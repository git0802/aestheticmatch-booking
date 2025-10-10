-- DropForeignKey
ALTER TABLE "public"."patients" DROP CONSTRAINT "patients_created_by_fkey";

-- DropForeignKey
ALTER TABLE "public"."patients" DROP CONSTRAINT "patients_updated_by_fkey";

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("workos_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("workos_id") ON DELETE RESTRICT ON UPDATE CASCADE;
