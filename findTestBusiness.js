// findTestBusiness.js
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: "contact@test2.ro" },
    include: { business: true },
  });

  if (!user) {
    console.error("❌ User negăsit.");
    return;
  }

  console.log("✅ User găsit:");
  console.log("  Email:", user.email);
  console.log("  BusinessId:", user.businessId);
  console.log("  Business Name:", user.business.name);
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());