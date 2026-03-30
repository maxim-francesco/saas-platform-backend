const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- CURATARE ISTORIC AUTOVIT ---');
  
  // 1. Gasim userul
  const user = await prisma.user.findUnique({
    where: { email: 'contact@vlc.ro' },
    include: { business: true }
  });

  if (!user) {
    console.error('Eroare: Utilizatorul contact@vlc.ro nu a fost gasit.');
    return;
  }

  const businessId = user.businessId;
  console.log(`Identificat business: ${user.business.name} (ID: ${businessId})`);

  // 2. Resetam toate listingurile pentru acest business
  const result = await prisma.listing.updateMany({
    where: { businessId: businessId },
    data: {
      autovitId: null,
      autovitStatus: null
    }
  });

  console.log(`Succes! Au fost resetate ${result.count} anunturi.`);
  console.log('Acum poti incerca sa publici anunturile din interfata.');
}

main()
  .catch((e) => {
    console.error('A aparut o eroare la curatare:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
