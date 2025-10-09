-- AlterTable
ALTER TABLE "patients" ADD COLUMN     "consent_forms_signed" BOOLEAN DEFAULT false,
ADD COLUMN     "privacy_notice_acknowledged" BOOLEAN DEFAULT false;
