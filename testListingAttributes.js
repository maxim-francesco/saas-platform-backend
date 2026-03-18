// testListingAttributes.js
require("dotenv").config();
const prisma = require("./src/config/prismaClient");

async function main() {
  // Găsim business-ul Test2
  const business = await prisma.business.findFirst({
    where: { users: { some: { email: "contact@test2.ro" } } },
  });

  console.log("Business:", business.name, "| ID:", business.id);

  // Găsim primul listing al acestui business
  const listing = await prisma.listing.findFirst({
    where: { businessId: business.id },
    include: {
      attributeValues: { include: { attribute: true } },
      images: { orderBy: { order: "asc" } },
      category: true,
    },
  });

  if (!listing) {
    console.log("\nNu există niciun listing pentru acest business.");
    console.log("\nAfișăm atributele disponibile din categorii:");
    
    const categories = await prisma.category.findMany({
      where: { businessId: business.id },
      include: { attributes: true },
    });

    categories.forEach(cat => {
      console.log(`\nCategoria: ${cat.name}`);
      cat.attributes.forEach(attr => {
        console.log(`  - "${attr.name}" (${attr.type})`);
      });
    });
    return;
  }

  console.log("\nListing:", listing.title);
  console.log("Mileage:", listing.mileage);
  console.log("Price:", listing.price);
  console.log("Categoria:", listing.category.name);
  console.log("\nAtribute:");
  listing.attributeValues.forEach(av => {
    console.log(`  - "${av.attribute.name}" (${av.attribute.type}): ${av.stringValue ?? av.numberValue ?? av.booleanValue}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());