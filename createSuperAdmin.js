const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();

async function main() {
  const email = "francesco"; // Sau adresa ta de email
  const password = "francesco";
  const hashedPassword = await bcrypt.hash(password, 10);

  // Mai întâi verificăm dacă există un business, 
  // Super Admin-ul are nevoie de o legătură cu un Business (conform schemei tale)
  let business = await prisma.business.findFirst();
  
  if (!business) {
    business = await prisma.business.create({
      data: { name: "System Admin Business" }
    });
  }

  const user = await prisma.user.upsert({
    where: { email: email },
    update: {
      role: "SUPER_ADMIN",
      password: hashedPassword
    },
    create: {
      email: email,
      password: hashedPassword,
      role: "SUPER_ADMIN",
      businessId: business.id
    }
  });

  console.log("Super Admin creat/actualizat cu succes:", user);
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());