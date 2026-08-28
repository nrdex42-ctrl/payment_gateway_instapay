import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const plans = [
  { name: 'FREE_TRIAL', priceEgp: 0, maxTransactions: 5 },
  { name: 'BASIC', priceEgp: 200, maxTransactions: 1000 },
  { name: 'PRO', priceEgp: 500, maxTransactions: 3500 },
  { name: 'ENTERPRISE', priceEgp: 700, maxTransactions: 10000 },
]

try {
  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { name: plan.name },
      create: plan,
      update: {
        priceEgp: plan.priceEgp,
        maxTransactions: plan.maxTransactions,
      },
    })
  }
  console.log(`[seed] Upserted ${plans.length} subscription plans.`)
} finally {
  await prisma.$disconnect()
}
