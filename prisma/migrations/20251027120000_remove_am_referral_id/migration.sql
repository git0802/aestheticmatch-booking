-- Drop AM Referral ID column from patients table
ALTER TABLE "patients" DROP COLUMN IF EXISTS "am_referral_id";