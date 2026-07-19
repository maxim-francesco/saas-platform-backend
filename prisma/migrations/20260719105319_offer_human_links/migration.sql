/*
  Warnings:

  - A unique constraint covering the columns `[code]` on the table `Offer` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."Offer" ADD COLUMN     "bizSlug" TEXT,
ADD COLUMN     "code" TEXT,
ALTER COLUMN "token" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Offer_code_key" ON "public"."Offer"("code");

-- CreateIndex
CREATE INDEX "Offer_code_idx" ON "public"."Offer"("code");
