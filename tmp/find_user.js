const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const user = await prisma.user.findUnique({ where: { email: 'contact@vlc.ro' } });
  console.log(JSON.stringify(user));
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
