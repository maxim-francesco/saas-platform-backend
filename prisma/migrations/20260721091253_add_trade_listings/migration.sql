-- CreateEnum
CREATE TYPE "public"."TradeListingStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- AlterEnum
ALTER TYPE "public"."ConversationContext" ADD VALUE 'TRADE';

-- CreateTable
CREATE TABLE "public"."NetworkTradeListing" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "b2bPrice" DOUBLE PRECISION,
    "acceptsTrade" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "status" "public"."TradeListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NetworkTradeListing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NetworkTradeListing_listingId_key" ON "public"."NetworkTradeListing"("listingId");

-- CreateIndex
CREATE INDEX "NetworkTradeListing_businessId_status_idx" ON "public"."NetworkTradeListing"("businessId", "status");

-- CreateIndex
CREATE INDEX "NetworkTradeListing_status_idx" ON "public"."NetworkTradeListing"("status");

-- AddForeignKey
ALTER TABLE "public"."NetworkTradeListing" ADD CONSTRAINT "NetworkTradeListing_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NetworkTradeListing" ADD CONSTRAINT "NetworkTradeListing_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "public"."Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
