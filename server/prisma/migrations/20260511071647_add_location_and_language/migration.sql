-- CreateEnum
CREATE TYPE "Language" AS ENUM ('ENGLISH', 'HINDI', 'MARATHI', 'TELUGU', 'TAMIL', 'KANNADA');

-- AlterTable
ALTER TABLE "crop_scans" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "farms" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "language" "Language" NOT NULL DEFAULT 'ENGLISH',
ADD COLUMN     "location" TEXT,
ALTER COLUMN "id" DROP DEFAULT;
