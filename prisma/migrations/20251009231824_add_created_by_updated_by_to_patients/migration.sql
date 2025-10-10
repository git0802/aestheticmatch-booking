/*
  Warnings:

  - Added the required column `created_by` to the `patients` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_by` to the `patients` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "patients" ADD COLUMN     "created_by" TEXT NOT NULL,
ADD COLUMN     "updated_by" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
