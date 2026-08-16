const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');

dotenv.config();
const prisma = new PrismaClient();

async function main() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: 'demo.auto@email.com' }
    });

    if (!user) {
      console.log("USER NOT FOUND — ABORTING");
      process.exit(1);
    }

    if (user.id !== 'cmgnq24q10083p02e9x78086w') {
      console.log("UNEXPECTED USER ID — ABORTING " + user.id);
      process.exit(1);
    }

    const beforeCompare = await bcrypt.compare('Test1234!', user.password);
    console.log(`BEFORE tokenVersion: ${user.tokenVersion}`);
    console.log(`BEFORE hash prefix: ${user.password.substring(0, 12)}`);
    console.log(`BEFORE compare Test1234!: ${beforeCompare}`);

    // Update exactly one row targeted by id
    const newHash = await bcrypt.hash('Test1234!', 10);
    await prisma.user.update({
      where: { id: 'cmgnq24q10083p02e9x78086w' },
      data: {
        password: newHash,
        tokenVersion: { increment: 1 }
      }
    });

    // Re-read and print AFTER values
    const updatedUser = await prisma.user.findUnique({
      where: { id: 'cmgnq24q10083p02e9x78086w' }
    });

    const afterCompare = await bcrypt.compare('Test1234!', updatedUser.password);
    console.log(`AFTER tokenVersion: ${updatedUser.tokenVersion}`);
    console.log(`AFTER hash prefix: ${updatedUser.password.substring(0, 12)}`);
    console.log(`AFTER compare Test1234!: ${afterCompare}`);

    const totalUsers = await prisma.user.count();
    console.log(`TOTAL USERS: ${totalUsers}`);

  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
