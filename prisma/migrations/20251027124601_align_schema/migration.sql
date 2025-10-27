-- CreateEnum
CREATE TYPE "EmrProvider" AS ENUM ('MINDBODY', 'NEXTECH', 'MODMED', 'PATIENTNOW');

-- CreateEnum
CREATE TYPE "OwnerType" AS ENUM ('PRACTICE', 'USER');

-- CreateTable
CREATE TABLE "emr_credentials" (
    "id" UUID NOT NULL,
    "provider" "EmrProvider" NOT NULL,
    "owner_id" UUID NOT NULL,
    "owner_type" "OwnerType" NOT NULL DEFAULT 'USER',
    "label" VARCHAR(100),
    "encrypted_data" TEXT NOT NULL,
    "fingerprint" VARCHAR(128) NOT NULL,
    "is_valid" BOOLEAN NOT NULL DEFAULT false,
    "last_validated_at" TIMESTAMP(3),
    "validation_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "emr_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_fees" (
    "id" UUID NOT NULL,
    "practice_id" UUID NOT NULL,
    "service_name" VARCHAR(255) NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_fees_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "emr_credentials_fingerprint_key" ON "emr_credentials"("fingerprint");

-- AddForeignKey
ALTER TABLE "service_fees" ADD CONSTRAINT "service_fees_practice_id_fkey" FOREIGN KEY ("practice_id") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
