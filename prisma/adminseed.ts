import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('secure123', 10);

  await prisma.admin.create({
    data: {
      email: 'admin@site.com',
      password: hashedPassword,
    },
  });

  console.log('✅ Admin created');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
