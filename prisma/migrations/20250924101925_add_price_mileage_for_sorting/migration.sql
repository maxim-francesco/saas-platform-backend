-- AlterTable
ALTER TABLE "public"."Listing" ADD COLUMN     "mileage" INTEGER,
ADD COLUMN     "price" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "Listing_price_idx" ON "public"."Listing"("price");

-- CreateIndex
CREATE INDEX "Listing_mileage_idx" ON "public"."Listing"("mileage");
