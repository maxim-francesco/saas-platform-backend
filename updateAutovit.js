// updateAutovit.js
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const updated = await prisma.business.update({
    where: { id: "cmlnd53xb003att1q8gxiqsg2" },
    data: {
      autovitClientId: "1751",
      autovitClientSecret: "a8000946efe2724d443ce4a458eef1ec",
      autovitUsername: "maaximfrancesco@gmail.com",
      autovitPassword: "U2NUWVZ4LKL7e*",
    },
  });

  console.log("✅ Credențiale Autovit salvate pentru:", updated.name);
  console.log("  autovitClientId:", updated.autovitClientId);
  console.log("  autovitUsername:", updated.autovitUsername);
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());