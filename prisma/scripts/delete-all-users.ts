import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Deleting all Notifications...');
  await prisma.notification.deleteMany({});
  console.log('🧹 Deleting all Payment Submissions...');
  await prisma.paymentSubmission.deleteMany({});
  console.log('🧹 Deleting all Users...');
  const result = await prisma.user.deleteMany({});
  console.log(`✅ Deleted ${result.count} users`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

//   npx ts-node prisma/scripts/delete-all-users.ts
