-- CreateEnum
CREATE TYPE "PatientGender" AS ENUM ('MALE', 'FEMALE');

-- AlterTable
ALTER TABLE "patients" ADD COLUMN     "gender" "PatientGender";
