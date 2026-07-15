-- CreateEnum
CREATE TYPE "public"."MessageType" AS ENUM ('GENERAL', 'STOCK', 'ORDER', 'BUYBACK');

-- CreateEnum
CREATE TYPE "public"."LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'VIEWING', 'OFFER', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "public"."LostReason" AS ENUM ('PRICE', 'BOUGHT_ELSEWHERE', 'UNREACHABLE', 'NOT_SERIOUS', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."ActivityKind" AS ENUM ('CREATED', 'STATUS_CHANGED', 'TYPE_CHANGED', 'NOTE', 'REMINDER_SET', 'REMINDER_CLEARED', 'LINKED_LISTING');

-- AlterTable
ALTER TABLE "public"."Message" ADD COLUMN     "listingId" TEXT,
ADD COLUMN     "lostReason" "public"."LostReason",
ADD COLUMN     "reminderAt" TIMESTAMP(3),
ADD COLUMN     "status" "public"."LeadStatus" NOT NULL DEFAULT 'NEW',
ADD COLUMN     "type" "public"."MessageType" NOT NULL DEFAULT 'GENERAL';

-- CreateTable
CREATE TABLE "public"."MessageActivity" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "kind" "public"."ActivityKind" NOT NULL,
    "fromValue" TEXT,
    "toValue" TEXT,
    "body" TEXT,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageActivity_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "public"."Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MessageActivity" ADD CONSTRAINT "MessageActivity_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "public"."Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
