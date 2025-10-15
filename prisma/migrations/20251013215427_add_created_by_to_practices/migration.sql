/*
  Warnings:

  - Added the required column `created_by` to the `practices` table without a default value. This is not possible if the table is not empty.

*/

-- First, add the column as nullable
ALTER TABLE "practices" ADD COLUMN "created_by" TEXT;

-- Update existing records to use the first admin user ID found, or create a system default
UPDATE "practices" 
SET "created_by" = (
  SELECT id FROM "users" 
  WHERE role = 'ADMIN' 
  LIMIT 1
) 
WHERE "created_by" IS NULL;

-- If no admin user exists, use the first user found
UPDATE "practices" 
SET "created_by" = (
  SELECT id FROM "users" 
  LIMIT 1
) 
WHERE "created_by" IS NULL;

-- Now make the column NOT NULL
ALTER TABLE "practices" ALTER COLUMN "created_by" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "practices" ADD CONSTRAINT "practices_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
