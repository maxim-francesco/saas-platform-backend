const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const business = await prisma.business.findFirst({
    where: { users: { some: { email: "contact@carsleasing.ro" } } },
    include: {
      categories: { include: { attributes: true } },
      users: true
    }
  });

  if (!business) {
    console.log("Business not found for contact@carsleasing.ro");
    return;
  }

  console.log("--- RESULTS ---");
  console.log("Business ID:", business.id);
  console.log("Name:", business.name);
  console.log("Banner URL:", business.bannerUrl || "Not set");
  console.log("\nCategories and Attributes:");
  
  business.categories.forEach(cat => {
    console.log(`\nCategory: ${cat.name} (ID: ${cat.id})`);
    cat.attributes.forEach(attr => {
      console.log(`  - ${attr.name} (Type: ${attr.type}, ID: ${attr.id})`);
    });
  });
  
}

main()
  .catch(e => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
