-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('SUPER_ADMIN', 'ADMIN');

-- CreateEnum
CREATE TYPE "public"."ListingStatus" AS ENUM ('INCOMING', 'AVAILABLE', 'RESERVED', 'SOLD');

-- CreateEnum
CREATE TYPE "public"."FuelType" AS ENUM ('PETROL', 'DIESEL', 'PETROL_LPG', 'LPG', 'HYBRID', 'PLUGIN_HYBRID', 'MILD_HYBRID', 'ELECTRIC');

-- CreateEnum
CREATE TYPE "public"."GearboxType" AS ENUM ('MANUAL', 'AUTOMATIC');

-- CreateEnum
CREATE TYPE "public"."Drivetrain" AS ENUM ('FWD', 'RWD', 'AWD');

-- CreateEnum
CREATE TYPE "public"."BodyType" AS ENUM ('SUV', 'SEDAN', 'HATCHBACK', 'BREAK', 'COUPE', 'CABRIO', 'MONOVOLUM', 'VAN', 'PICKUP');

-- CreateEnum
CREATE TYPE "public"."PollutionNorm" AS ENUM ('NON_EURO', 'EURO_1', 'EURO_2', 'EURO_3', 'EURO_4', 'EURO_5', 'EURO_6', 'EURO_6D');

-- CreateEnum
CREATE TYPE "public"."CarColor" AS ENUM ('BLACK', 'GREY', 'WHITE', 'BLUE', 'RED', 'BROWN', 'SILVER', 'ORANGE', 'GREEN', 'PURPLE', 'GOLD', 'BEIGE', 'YELLOW', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."Upholstery" AS ENUM ('FABRIC', 'VELOUR', 'LEATHER', 'PARTIAL_LEATHER', 'ALCANTARA');

-- CreateEnum
CREATE TYPE "public"."AirConditioning" AS ENUM ('NONE', 'MANUAL', 'AUTOMATIC', 'DUAL_ZONE', 'TRI_ZONE', 'QUAD_ZONE');

-- CreateEnum
CREATE TYPE "public"."FeatureGroup" AS ENUM ('SAFETY', 'COMFORT', 'MULTIMEDIA', 'EXTERIOR', 'SERVICES');

-- CreateTable
CREATE TABLE "public"."Business" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "bannerUrl" TEXT,
    "listingUrlPattern" TEXT,
    "bestAutoApiKey" TEXT,
    "autovitClientId" TEXT,
    "autovitClientSecret" TEXT,
    "autovitUsername" TEXT,
    "autovitPassword" TEXT,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "role" "public"."Role" NOT NULL DEFAULT 'ADMIN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "businessId" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Make" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "autovitCode" TEXT,

    CONSTRAINT "Make_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CarModel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "makeId" TEXT NOT NULL,
    "autovitCode" TEXT,

    CONSTRAINT "CarModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Feature" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "group" "public"."FeatureGroup" NOT NULL,

    CONSTRAINT "Feature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Listing" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" "public"."ListingStatus" NOT NULL DEFAULT 'AVAILABLE',
    "title" TEXT NOT NULL,
    "slug" TEXT,
    "description" TEXT,
    "makeId" TEXT,
    "modelId" TEXT,
    "variant" TEXT,
    "year" INTEGER,
    "vin" TEXT,
    "firstRegistrationAt" TIMESTAMP(3),
    "countryOfOrigin" VARCHAR(2),
    "registeredInRo" BOOLEAN,
    "mileage" INTEGER,
    "fuelType" "public"."FuelType",
    "gearbox" "public"."GearboxType",
    "drivetrain" "public"."Drivetrain",
    "bodyType" "public"."BodyType",
    "engineCapacity" INTEGER,
    "powerHp" INTEGER,
    "pollutionNorm" "public"."PollutionNorm",
    "co2Emissions" INTEGER,
    "color" "public"."CarColor",
    "colorDetail" TEXT,
    "upholstery" "public"."Upholstery",
    "airConditioning" "public"."AirConditioning",
    "doors" INTEGER,
    "seats" INTEGER,
    "vatDeductible" BOOLEAN,
    "noAccidents" BOOLEAN,
    "serviceBook" BOOLEAN,
    "firstOwner" BOOLEAN,
    "ownerCount" INTEGER,
    "warrantyMonths" INTEGER,
    "price" DOUBLE PRECISION,
    "purchasePrice" DOUBLE PRECISION,
    "sellingPrice" DOUBLE PRECISION,
    "otherCosts" DOUBLE PRECISION,
    "soldAt" TIMESTAMP(3),
    "internalNotes" TEXT,
    "youtubeVideoId" TEXT,
    "autovitId" BIGINT,
    "autovitStatus" TEXT,
    "extraSpecs" JSONB,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ListingImage" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ListingImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Message" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "businessId" TEXT NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."View" (
    "id" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "businessId" TEXT NOT NULL,
    "listingId" TEXT,

    CONSTRAINT "View_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Review" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "businessId" TEXT NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BlogPost" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "categoryKey" TEXT NOT NULL,
    "readTime" TEXT NOT NULL,
    "coverImage" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "businessId" TEXT NOT NULL,

    CONSTRAINT "BlogPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."_FeatureToListing" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_FeatureToListing_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Business_name_key" ON "public"."Business"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Make_name_key" ON "public"."Make"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Make_slug_key" ON "public"."Make"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Make_autovitCode_key" ON "public"."Make"("autovitCode");

-- CreateIndex
CREATE UNIQUE INDEX "CarModel_makeId_slug_key" ON "public"."CarModel"("makeId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Feature_slug_key" ON "public"."Feature"("slug");

-- CreateIndex
CREATE INDEX "Listing_businessId_status_idx" ON "public"."Listing"("businessId", "status");

-- CreateIndex
CREATE INDEX "Listing_price_idx" ON "public"."Listing"("price");

-- CreateIndex
CREATE INDEX "Listing_mileage_idx" ON "public"."Listing"("mileage");

-- CreateIndex
CREATE INDEX "Listing_year_idx" ON "public"."Listing"("year");

-- CreateIndex
CREATE INDEX "Listing_makeId_idx" ON "public"."Listing"("makeId");

-- CreateIndex
CREATE INDEX "Listing_modelId_idx" ON "public"."Listing"("modelId");

-- CreateIndex
CREATE INDEX "Listing_fuelType_idx" ON "public"."Listing"("fuelType");

-- CreateIndex
CREATE INDEX "Review_businessId_isApproved_idx" ON "public"."Review"("businessId", "isApproved");

-- CreateIndex
CREATE INDEX "BlogPost_businessId_isPublished_idx" ON "public"."BlogPost"("businessId", "isPublished");

-- CreateIndex
CREATE UNIQUE INDEX "BlogPost_slug_businessId_key" ON "public"."BlogPost"("slug", "businessId");

-- CreateIndex
CREATE INDEX "_FeatureToListing_B_index" ON "public"."_FeatureToListing"("B");

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CarModel" ADD CONSTRAINT "CarModel_makeId_fkey" FOREIGN KEY ("makeId") REFERENCES "public"."Make"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Listing" ADD CONSTRAINT "Listing_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Listing" ADD CONSTRAINT "Listing_makeId_fkey" FOREIGN KEY ("makeId") REFERENCES "public"."Make"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Listing" ADD CONSTRAINT "Listing_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "public"."CarModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ListingImage" ADD CONSTRAINT "ListingImage_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "public"."Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."View" ADD CONSTRAINT "View_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."View" ADD CONSTRAINT "View_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "public"."Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Review" ADD CONSTRAINT "Review_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BlogPost" ADD CONSTRAINT "BlogPost_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_FeatureToListing" ADD CONSTRAINT "_FeatureToListing_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Feature"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_FeatureToListing" ADD CONSTRAINT "_FeatureToListing_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
