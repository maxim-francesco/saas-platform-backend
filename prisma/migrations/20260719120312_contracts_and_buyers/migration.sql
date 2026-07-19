-- CreateEnum
CREATE TYPE "public"."BuyerType" AS ENUM ('INDIVIDUAL', 'COMPANY');

-- CreateTable
CREATE TABLE "public"."Buyer" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "type" "public"."BuyerType" NOT NULL DEFAULT 'INDIVIDUAL',
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "cnp" TEXT,
    "ciSeries" TEXT,
    "ciNumber" TEXT,
    "cui" TEXT,
    "regCom" TEXT,
    "legalRep" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Buyer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Contract" (
    "id" TEXT NOT NULL,
    "contractNumber" INTEGER NOT NULL,
    "businessId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "listingId" TEXT,
    "salePrice" DOUBLE PRECISION NOT NULL,
    "saleDate" TIMESTAMP(3) NOT NULL,
    "vin" TEXT,
    "plateNumber" TEXT,
    "mileageAtSale" INTEGER,
    "sellerSnapshot" JSONB NOT NULL,
    "buyerSnapshot" JSONB NOT NULL,
    "vehicleSnapshot" JSONB NOT NULL,
    "clauses" TEXT,
    "handoverDate" TIMESTAMP(3),
    "handoverMileage" INTEGER,
    "handoverNotes" TEXT,
    "handoverItems" JSONB,
    "token" TEXT,
    "code" TEXT,
    "bizSlug" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Buyer_businessId_idx" ON "public"."Buyer"("businessId");

-- CreateIndex
CREATE INDEX "Buyer_businessId_cnp_idx" ON "public"."Buyer"("businessId", "cnp");

-- CreateIndex
CREATE INDEX "Buyer_businessId_cui_idx" ON "public"."Buyer"("businessId", "cui");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_token_key" ON "public"."Contract"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_code_key" ON "public"."Contract"("code");

-- CreateIndex
CREATE INDEX "Contract_businessId_idx" ON "public"."Contract"("businessId");

-- CreateIndex
CREATE INDEX "Contract_buyerId_idx" ON "public"."Contract"("buyerId");

-- CreateIndex
CREATE INDEX "Contract_code_idx" ON "public"."Contract"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_businessId_contractNumber_key" ON "public"."Contract"("businessId", "contractNumber");

-- AddForeignKey
ALTER TABLE "public"."Buyer" ADD CONSTRAINT "Buyer_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Contract" ADD CONSTRAINT "Contract_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Contract" ADD CONSTRAINT "Contract_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "public"."Buyer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Contract" ADD CONSTRAINT "Contract_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "public"."Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
