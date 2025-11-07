/*
  Warnings:

  - You are about to drop the column `name` on the `patients` table. All the data in the column will be lost.
  - Added the required column `first_name` to the `patients` table without a default value. This is not possible if the table is not empty.
  - Added the required column `last_name` to the `patients` table without a default value. This is not possible if the table is not empty.

*/
-- Add new columns with default values first
ALTER TABLE "patients" ADD COLUMN "first_name" VARCHAR(100) NOT NULL DEFAULT '';
ALTER TABLE "patients" ADD COLUMN "last_name" VARCHAR(155) NOT NULL DEFAULT '';

-- Migrate existing data: split name on first space
UPDATE "patients" 
SET 
  "first_name" = CASE 
    WHEN POSITION(' ' IN "name") > 0 THEN TRIM(SUBSTRING("name", 1, POSITION(' ' IN "name")))
    ELSE TRIM("name")
  END,
  "last_name" = CASE 
    WHEN POSITION(' ' IN "name") > 0 THEN TRIM(SUBSTRING("name", POSITION(' ' IN "name") + 1))
    ELSE ''
  END;

-- Drop the old name column
ALTER TABLE "patients" DROP COLUMN "name";

-- Remove defaults
ALTER TABLE "patients" ALTER COLUMN "first_name" DROP DEFAULT;
ALTER TABLE "patients" ALTER COLUMN "last_name" DROP DEFAULT;
