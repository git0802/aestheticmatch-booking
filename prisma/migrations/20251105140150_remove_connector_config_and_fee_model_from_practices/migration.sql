/*
  Warnings:

  - You are about to drop the column `connector_config` on the `practices` table. All the data in the column will be lost.
  - You are about to drop the column `fee_model` on the `practices` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "practices" DROP COLUMN "connector_config",
DROP COLUMN "fee_model";
