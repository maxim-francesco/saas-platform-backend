-- CreateEnum
CREATE TYPE "public"."TransportKind" AS ENUM ('OFFER', 'REQUEST');

-- CreateEnum
CREATE TYPE "public"."TransportType" AS ENUM ('PLATFORM_OPEN', 'ENCLOSED', 'TARP');

-- AlterTable
ALTER TABLE "public"."TransportRun" ADD COLUMN     "acceptsNonRunning" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "departureDateEnd" TIMESTAMP(3),
ADD COLUMN     "fromCountry" VARCHAR(2),
ADD COLUMN     "kind" "public"."TransportKind" NOT NULL DEFAULT 'OFFER',
ADD COLUMN     "transportType" "public"."TransportType";
