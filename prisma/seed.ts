import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const plans = [
    {
      name: 'BASIC',
      label: 'Basic Plan',
      description: 'Includes signals and basic consulting access',
      price: 100000, // e.g., KRW
      durationDays: 30,
      features: {
        SIGNAL_CHARTS: true,
        TELEGRAM_BASIC: true,
        CONSULT_1ON1: true,
      },
    },
    {
      name: 'PRO',
      label: 'Pro Plan',
      description: 'Pro-level access with Martingale EA and Telegram PRO',
      price: 250000,
      durationDays: 90,
      features: {
        SIGNAL_CHARTS: true,
        TELEGRAM_BASIC: true,
        CONSULT_1ON1: true,
        TELEGRAM_PRO: true,
        MARTINGALE_EA: true,
      },
    },
    {
      name: 'VIP',
      label: 'VIP Plan',
      description: 'VIP access with all features and Telegram VIP group',
      price: 600000,
      durationDays: 180,
      features: {
        SIGNAL_CHARTS: true,
        TELEGRAM_BASIC: true,
        CONSULT_1ON1: true,
        TELEGRAM_PRO: true,
        MARTINGALE_EA: true,
        TELEGRAM_VIP: true,
      },
    },
  ];

  for (const plan of plans) {
    await prisma.membershipPlanMeta.upsert({
      where: { name: plan.name },
      update: {},
      create: plan,
    });
  }

  console.log('✅ Seeded membership plans');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
