-- AlterTable Business
ALTER TABLE "public"."Business" ADD COLUMN IF NOT EXISTS "autovitClientId" TEXT;
ALTER TABLE "public"."Business" ADD COLUMN IF NOT EXISTS "autovitClientSecret" TEXT;
ALTER TABLE "public"."Business" ADD COLUMN IF NOT EXISTS "autovitPassword" TEXT;
ALTER TABLE "public"."Business" ADD COLUMN IF NOT EXISTS "autovitUsername" TEXT;
ALTER TABLE "public"."Business" ADD COLUMN IF NOT EXISTS "bestAutoApiKey" TEXT;
ALTER TABLE "public"."Business" ADD COLUMN IF NOT EXISTS "listingUrlPattern" TEXT;

-- AlterTable Listing
ALTER TABLE "public"."Listing" ADD COLUMN IF NOT EXISTS "autovitId" INTEGER;
ALTER TABLE "public"."Listing" ADD COLUMN IF NOT EXISTS "autovitStatus" TEXT;
ALTER TABLE "public"."Listing" ADD COLUMN IF NOT EXISTS "slug" TEXT;
ALTER TABLE "public"."Listing" ADD COLUMN IF NOT EXISTS "youtubeVideoId" TEXT;