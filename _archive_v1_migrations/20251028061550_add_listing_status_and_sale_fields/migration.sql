-- CreateEnum
CREATE TYPE "public"."ListingStatus" AS ENUM ('AVAILABLE', 'SOLD');

-- AlterTable
ALTER TABLE "public"."Listing" ADD COLUMN     "otherCosts" DOUBLE PRECISION,
ADD COLUMN     "purchasePrice" DOUBLE PRECISION,
ADD COLUMN     "sellingPrice" DOUBLE PRECISION,
ADD COLUMN     "soldAt" TIMESTAMP(3),
ADD COLUMN     "status" "public"."ListingStatus" NOT NULL DEFAULT 'AVAILABLE';
