-- AlterTable
ALTER TABLE "public"."Attribute" ADD COLUMN     "attributeGroupId" TEXT;

-- CreateTable
CREATE TABLE "public"."AttributeGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,

    CONSTRAINT "AttributeGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AttributeGroup_name_businessId_key" ON "public"."AttributeGroup"("name", "businessId");

-- AddForeignKey
ALTER TABLE "public"."AttributeGroup" ADD CONSTRAINT "AttributeGroup_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Attribute" ADD CONSTRAINT "Attribute_attributeGroupId_fkey" FOREIGN KEY ("attributeGroupId") REFERENCES "public"."AttributeGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
