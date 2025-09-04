import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: { userNumber: null },
    orderBy: { createdAt: 'asc' },
  });

  let current = 80000;

  for (const user of users) {
    await prisma.user.update({
      where: { id: user.id },
      data: { userNumber: current++ },
    });
  }

  console.log('✅ Assigned user numbers to existing users.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

// npx ts-node prisma/scripts/assign-user-numbers.ts
