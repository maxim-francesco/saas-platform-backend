const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function blockUser() {
  try {
    const emailToBlock = 'contact@sevencenterauto.ro';
    
    // Find the user
    const user = await prisma.user.findUnique({
      where: { email: emailToBlock }
    });

    if (!user) {
      console.log(`User cu email ${emailToBlock} nu a fost găsit.`);
      return;
    }

    // Block by scrambling the password to an impossible value and incrementing tokenVersion
    await prisma.user.update({
      where: { email: emailToBlock },
      data: {
        password: `BLOCKED_${Math.random().toString(36).substring(2)}_${Date.now()}`,
        tokenVersion: { increment: 1 }
      }
    });

    console.log(`User ${emailToBlock} a fost blocat cu succes pe producție.`);
  } catch (error) {
    console.error('Eroare:', error);
  } finally {
    await prisma.$disconnect();
  }
}

blockUser();
