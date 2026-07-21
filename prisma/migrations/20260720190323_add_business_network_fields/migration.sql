-- AlterTable
ALTER TABLE "public"."Business" ADD COLUMN     "city" TEXT,
ADD COLUMN     "networkContactEmail" TEXT,
ADD COLUMN     "networkContactPhone" TEXT,
ADD COLUMN     "networkDisplayName" TEXT,
ADD COLUMN     "networkEnabled" BOOLEAN NOT NULL DEFAULT true;
