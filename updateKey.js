// updateKey.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("Se caută business-ul 'AWD Auto'...");

  // 1. Căutăm business-ul. Dacă numele nu e exact "AWD Auto", schimbă aici.
  // Folosim findFirst pentru a fi siguri că găsim ceva similar.
  const business = await prisma.business.findFirst({
    where: {
      name: {
        contains: "AWD Auto", // Caută ceva ce conține "AWD Auto"
        mode: "insensitive", // Ignoră majuscule/minuscule
      },
    },
  });

  if (!business) {
    console.error("❌ EROARE: Nu am găsit niciun business cu numele 'AWD Auto'.");
    return;
  }

  console.log(`✅ Găsit: ${business.name} (ID: ${business.id})`);

  // 2. Actualizăm cheia API
  const updated = await prisma.business.update({
    where: { id: business.id },
    data: {
      bestAutoApiKey: "hezhd5rlee2l5envds3r", // Cheia primită de tine
    },
  });

  console.log("✅ SUCCES! Cheia API a fost salvată în baza de date.");
  console.log("Business:", updated.name);
  console.log("Key set:", updated.bestAutoApiKey);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });