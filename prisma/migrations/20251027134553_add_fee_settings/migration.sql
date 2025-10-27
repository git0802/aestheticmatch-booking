-- CreateTable
CREATE TABLE "fee_settings" (
    "id" UUID NOT NULL,
    "consultFee" DECIMAL(10,2) NOT NULL,
    "surgeryFee" DECIMAL(10,2) NOT NULL,
    "nonSurgicalFee" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fee_settings_pkey" PRIMARY KEY ("id")
);
