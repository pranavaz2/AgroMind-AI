-- PostgreSQL uses extensions for some optional database features.
-- gen_random_uuid() is available through pgcrypto and is a reliable UUID default.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "UserRole" AS ENUM ('FARMER', 'AGRONOMIST', 'ADMIN');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');
CREATE TYPE "FarmUnit" AS ENUM ('ACRE', 'HECTARE');
CREATE TYPE "CropScanStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

CREATE TABLE "users" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "full_name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'FARMER',
  "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  "phone_number" TEXT,
  "email_verified_at" TIMESTAMP(3),
  "last_login_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "farms" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "location" TEXT,
  "size" DECIMAL(10,2),
  "unit" "FarmUnit" NOT NULL DEFAULT 'ACRE',
  "owner_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "farms_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "crop_scans" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "crop_name" TEXT NOT NULL,
  "image_url" TEXT,
  "ai_summary" TEXT,
  "status" "CropScanStatus" NOT NULL DEFAULT 'PENDING',
  "confidence" DECIMAL(5,2),
  "user_id" UUID NOT NULL,
  "farm_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "crop_scans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "farms_owner_id_idx" ON "farms"("owner_id");
CREATE INDEX "crop_scans_user_id_idx" ON "crop_scans"("user_id");
CREATE INDEX "crop_scans_farm_id_idx" ON "crop_scans"("farm_id");

ALTER TABLE "farms"
  ADD CONSTRAINT "farms_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "crop_scans"
  ADD CONSTRAINT "crop_scans_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "crop_scans"
  ADD CONSTRAINT "crop_scans_farm_id_fkey"
  FOREIGN KEY ("farm_id") REFERENCES "farms"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
