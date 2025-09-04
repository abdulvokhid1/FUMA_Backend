import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Deleting all Notifications...');
  await prisma.notification.deleteMany({});

  console.log('🧹 Deleting all Payment Submissions...');
  await prisma.paymentSubmission.deleteMany({});

  console.log('🧹 Deleting all UserPlanGrants...');
  await prisma.userPlanGrant.deleteMany({});

  console.log('🧹 Deleting all Users...');
  const result = await prisma.user.deleteMany({});
  console.log(`✅ Deleted ${result.count} users`);

  console.log('🔄 Resetting User ID sequence...');
  await prisma.$executeRawUnsafe(`ALTER SEQUENCE "User_id_seq" RESTART WITH 1`);

  console.log('✅ All done.');
}

main()
  .catch((err) => {
    console.error('❌ Error during cleanup:', err);
  })
  .finally(() => prisma.$disconnect());

// npx ts-node prisma/scripts/delete-all-users.ts
