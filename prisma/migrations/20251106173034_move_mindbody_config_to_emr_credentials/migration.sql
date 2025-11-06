/*
  Warnings:

  - You are about to drop the column `mindbody_location_id` on the `practices` table. All the data in the column will be lost.
  - You are about to drop the column `mindbody_session_type_id` on the `practices` table. All the data in the column will be lost.
  - You are about to drop the column `mindbody_staff_id` on the `practices` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "emr_credentials" ADD COLUMN     "mindbody_location_id" VARCHAR(50),
ADD COLUMN     "mindbody_session_type_id" VARCHAR(50),
ADD COLUMN     "mindbody_staff_id" VARCHAR(50);

-- AlterTable
ALTER TABLE "practices" DROP COLUMN "mindbody_location_id",
DROP COLUMN "mindbody_session_type_id",
DROP COLUMN "mindbody_staff_id";
