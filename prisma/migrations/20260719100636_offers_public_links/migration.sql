-- CreateTable
CREATE TABLE "public"."Offer" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "listingId" TEXT,
    "clientName" TEXT NOT NULL,
    "clientPhone" TEXT NOT NULL,
    "offerPrice" DOUBLE PRECISION NOT NULL,
    "listPrice" DOUBLE PRECISION,
    "validityDays" INTEGER NOT NULL DEFAULT 5,
    "listingTitleSnapshot" TEXT NOT NULL,
    "listingImageSnapshot" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "viewedAt" TIMESTAMP(3),

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Offer_token_key" ON "public"."Offer"("token");

-- CreateIndex
CREATE INDEX "Offer_businessId_idx" ON "public"."Offer"("businessId");

-- CreateIndex
CREATE INDEX "Offer_token_idx" ON "public"."Offer"("token");

-- AddForeignKey
ALTER TABLE "public"."Offer" ADD CONSTRAINT "Offer_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Offer" ADD CONSTRAINT "Offer_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "public"."Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
