-- CreateTable
CREATE TABLE "practices" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "emr_type" VARCHAR(50),
    "connector_config" TEXT,
    "fee_model" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "practices_pkey" PRIMARY KEY ("id")
);
