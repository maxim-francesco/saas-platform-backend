const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');
dotenv.config();

const prisma = new PrismaClient();

// Usage: node scripts/reset_client_password.js --email <email> [--business <businessId>] [--write]
const argv = process.argv;
const emailIdx = argv.indexOf('--email');
const bizIdx = argv.indexOf('--business');
const DRY = !argv.includes('--write');

const EMAIL = emailIdx !== -1 ? argv[emailIdx + 1] : null;
const EXPECTED_BUSINESS = bizIdx !== -1 ? argv[bizIdx + 1] : null;
const NEW_PASSWORD = 'Test1234!';

async function main() {
  if (!EMAIL) {
    console.error('CRITICAL: --email <email> is required. Aborting.');
    process.exit(1);
  }
  try {
    const user = await prisma.user.findUnique({ where: { email: EMAIL } });
    if (!user) {
      console.log(`USER NOT FOUND for email "${EMAIL}" — ABORTING`);
      process.exit(1);
    }
    if (EXPECTED_BUSINESS && user.businessId !== EXPECTED_BUSINESS) {
      console.log(`BUSINESS MISMATCH: user.businessId=${user.businessId} expected=${EXPECTED_BUSINESS} — ABORTING`);
      process.exit(1);
    }
    console.log(`Target user: ${user.email} (id=${user.id}, businessId=${user.businessId}, role=${user.role})`);
    console.log(`Mode: ${DRY ? 'DRY-RUN (no write)' : 'WRITE'}`);
    const beforeCompare = await bcrypt.compare(NEW_PASSWORD, user.password);
    console.log(`BEFORE compare ${NEW_PASSWORD}: ${beforeCompare}`);

    if (DRY) {
      console.log('DRY-RUN: would reset password and increment tokenVersion. No changes made.');
      return;
    }

    const newHash = await bcrypt.hash(NEW_PASSWORD, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: newHash, tokenVersion: { increment: 1 } }
    });
    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    const afterCompare = await bcrypt.compare(NEW_PASSWORD, updated.password);
    console.log(`AFTER compare ${NEW_PASSWORD}: ${afterCompare}`);
    console.log(afterCompare ? 'PASSWORD RESET OK' : 'PASSWORD RESET FAILED');
  } catch (error) {
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}
main();
