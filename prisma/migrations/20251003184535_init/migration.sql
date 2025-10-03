-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CONCIERGE', 'OPS_FINANCE', 'OPS_MARKETING');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "workos_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'OPS_FINANCE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_workos_id_key" ON "users"("workos_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
