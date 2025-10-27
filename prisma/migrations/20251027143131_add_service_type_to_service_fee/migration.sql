-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('consult', 'surgery', 'non_surgical');

-- AlterTable
ALTER TABLE "service_fees" ADD COLUMN     "service_type" "ServiceType" NOT NULL DEFAULT 'consult';
