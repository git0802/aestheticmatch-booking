/*
  Warnings:

  - You are about to drop the column `address_line1` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `city` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `postal_code` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `state` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "patients" ADD COLUMN     "address_line1" VARCHAR(255),
ADD COLUMN     "city" VARCHAR(100),
ADD COLUMN     "postal_code" VARCHAR(20),
ADD COLUMN     "state" VARCHAR(50);

-- AlterTable
ALTER TABLE "users" DROP COLUMN "address_line1",
DROP COLUMN "city",
DROP COLUMN "postal_code",
DROP COLUMN "state";
