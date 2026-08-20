import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

// Self-seeding configuration for subscription plans
async function seedPlans() {
  try {
    const count = await db.plan.count()
    if (count === 0) {
      console.log('[seeder] Plan table is empty. Seeding default subscription plans...')
      await db.plan.createMany({
        data: [
          { name: 'FREE_TRIAL', priceEgp: 0, maxTransactions: 5 },
          { name: 'BASIC', priceEgp: 200, maxTransactions: 1000 },
          { name: 'PRO', priceEgp: 500, maxTransactions: 3500 },
          { name: 'ENTERPRISE', priceEgp: 700, maxTransactions: 10000 },
        ],
      })
      console.log('[seeder] Seeded subscription plans successfully.')
    }
  } catch (err) {
    console.error('[seeder] Failed to seed subscription plans:', err)
  }
}

// Trigger seeder in background
void seedPlans()