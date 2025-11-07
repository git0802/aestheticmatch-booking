-- Drop the DayOfWeek enum type if it exists
DROP TYPE IF EXISTS "DayOfWeek" CASCADE;

-- Drop and recreate practice_availabilities table with new schema
DROP TABLE IF EXISTS "practice_availabilities" CASCADE;

CREATE TABLE "practice_availabilities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "practice_id" UUID NOT NULL,
    "start_date_time" TIMESTAMP(3) NOT NULL,
    "end_date_time" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "practice_availabilities_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraint
ALTER TABLE "practice_availabilities" ADD CONSTRAINT "practice_availabilities_practice_id_fkey" FOREIGN KEY ("practice_id") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
