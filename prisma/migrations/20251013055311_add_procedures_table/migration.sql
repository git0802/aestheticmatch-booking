-- CreateEnum
CREATE TYPE "ProcedureCategory" AS ENUM ('SURGICAL', 'NON_SURGICAL');

-- CreateEnum
CREATE TYPE "FeeRule" AS ENUM ('TIER_A', 'TIER_B', 'CONSULT', 'SURGERY');

-- CreateTable
CREATE TABLE "procedures" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "category" "ProcedureCategory" NOT NULL,
    "default_fee_rule" "FeeRule" NOT NULL,
    "fee_amount" DECIMAL(10,2) NOT NULL,
    "linked_practices" UUID[],
    "created_by" TEXT NOT NULL,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "procedures_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "procedures" ADD CONSTRAINT "procedures_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procedures" ADD CONSTRAINT "procedures_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
