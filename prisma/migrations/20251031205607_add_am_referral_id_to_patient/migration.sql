/*
  Warnings:

  - A unique constraint covering the columns `[am_referral_id]` on the table `patients` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "patients" ADD COLUMN     "am_referral_id" VARCHAR(100);

-- CreateIndex
CREATE UNIQUE INDEX "patients_am_referral_id_key" ON "patients"("am_referral_id");
