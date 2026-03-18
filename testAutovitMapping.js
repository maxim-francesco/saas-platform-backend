// testAutovitMapping.js
require("dotenv").config();
const prisma = require("./src/config/prismaClient");
const { mapListingToAutovit } = require("./src/services/autovitService");

async function main() {
  const listing = await prisma.listing.findFirst({
    where: { business: { users: { some: { email: "contact@test2.ro" } } } },
    include: {
      attributeValues: { include: { attribute: true } },
      images: { orderBy: { order: "asc" } },
      business: true,
    },
  });

  console.log("Listing:", listing.title);
  const mapped = mapListingToAutovit(listing, "TEST_IMAGE_COLLECTION_ID");
  console.log("\nPayload Autovit:");
  console.log(JSON.stringify(mapped, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());