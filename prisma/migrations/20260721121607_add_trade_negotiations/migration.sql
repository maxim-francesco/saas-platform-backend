-- CreateEnum
CREATE TYPE "public"."TradeNegotiationStatus" AS ENUM ('OPEN', 'ACCEPTED', 'DECLINED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."TradeProposalKind" AS ENUM ('BUY', 'EXCHANGE');

-- CreateEnum
CREATE TYPE "public"."TradeProposalStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'SUPERSEDED');

-- CreateTable
CREATE TABLE "public"."TradeNegotiation" (
    "id" TEXT NOT NULL,
    "tradeListingId" TEXT NOT NULL,
    "ownerBusinessId" TEXT NOT NULL,
    "buyerBusinessId" TEXT NOT NULL,
    "status" "public"."TradeNegotiationStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradeNegotiation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TradeProposal" (
    "id" TEXT NOT NULL,
    "negotiationId" TEXT NOT NULL,
    "proposerBusinessId" TEXT NOT NULL,
    "kind" "public"."TradeProposalKind" NOT NULL,
    "offeredPrice" DOUBLE PRECISION,
    "offeredListingId" TEXT,
    "note" TEXT,
    "status" "public"."TradeProposalStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradeProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TradeNegotiation_ownerBusinessId_status_idx" ON "public"."TradeNegotiation"("ownerBusinessId", "status");

-- CreateIndex
CREATE INDEX "TradeNegotiation_buyerBusinessId_status_idx" ON "public"."TradeNegotiation"("buyerBusinessId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TradeNegotiation_tradeListingId_buyerBusinessId_key" ON "public"."TradeNegotiation"("tradeListingId", "buyerBusinessId");

-- CreateIndex
CREATE INDEX "TradeProposal_negotiationId_createdAt_idx" ON "public"."TradeProposal"("negotiationId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."TradeNegotiation" ADD CONSTRAINT "TradeNegotiation_tradeListingId_fkey" FOREIGN KEY ("tradeListingId") REFERENCES "public"."NetworkTradeListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TradeNegotiation" ADD CONSTRAINT "TradeNegotiation_ownerBusinessId_fkey" FOREIGN KEY ("ownerBusinessId") REFERENCES "public"."Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TradeNegotiation" ADD CONSTRAINT "TradeNegotiation_buyerBusinessId_fkey" FOREIGN KEY ("buyerBusinessId") REFERENCES "public"."Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TradeProposal" ADD CONSTRAINT "TradeProposal_negotiationId_fkey" FOREIGN KEY ("negotiationId") REFERENCES "public"."TradeNegotiation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TradeProposal" ADD CONSTRAINT "TradeProposal_proposerBusinessId_fkey" FOREIGN KEY ("proposerBusinessId") REFERENCES "public"."Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TradeProposal" ADD CONSTRAINT "TradeProposal_offeredListingId_fkey" FOREIGN KEY ("offeredListingId") REFERENCES "public"."Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
