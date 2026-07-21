-- CreateEnum
CREATE TYPE "public"."TransportRunStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateTable
CREATE TABLE "public"."TransportRun" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "fromCity" TEXT NOT NULL,
    "toCity" TEXT NOT NULL,
    "departureDate" TIMESTAMP(3) NOT NULL,
    "seatsTotal" INTEGER NOT NULL,
    "seatsAvailable" INTEGER NOT NULL,
    "pricePerCar" DOUBLE PRECISION,
    "notes" TEXT,
    "status" "public"."TransportRunStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransportRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TransportInterest" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "seatsRequested" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT,
    "isSeen" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransportInterest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TransportRun_businessId_idx" ON "public"."TransportRun"("businessId");

-- CreateIndex
CREATE INDEX "TransportRun_status_departureDate_idx" ON "public"."TransportRun"("status", "departureDate");

-- CreateIndex
CREATE INDEX "TransportInterest_businessId_idx" ON "public"."TransportInterest"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "TransportInterest_runId_businessId_key" ON "public"."TransportInterest"("runId", "businessId");

-- AddForeignKey
ALTER TABLE "public"."TransportRun" ADD CONSTRAINT "TransportRun_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TransportInterest" ADD CONSTRAINT "TransportInterest_runId_fkey" FOREIGN KEY ("runId") REFERENCES "public"."TransportRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TransportInterest" ADD CONSTRAINT "TransportInterest_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
