// prisma/cleanup.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanup() {
  console.log('🧹 Cleaning database tables...');

  await prisma.notification.deleteMany();
  await prisma.user.deleteMany();
  await prisma.faq.deleteMany();
  await prisma.admin.deleteMany();

  console.log('✅ Cleanup completed.');
}

cleanup()
  .catch((e) => {
    console.error('❌ Cleanup failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
