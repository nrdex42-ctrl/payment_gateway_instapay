import crypto from 'crypto'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const pepper = process.env.TOKEN_PEPPER || process.env.OWNER_SECRET

if (!pepper) {
  console.error('TOKEN_PEPPER or OWNER_SECRET is required for token hash backfill.')
  process.exit(1)
}

function hashSecret(secret) {
  return crypto.createHmac('sha256', pepper).update(secret).digest('hex')
}

function toCents(amount) {
  return Math.round(Number(amount) * 100)
}

try {
  const clients = await prisma.client.findMany()
  for (const client of clients) {
    const data = {}
    if (client.apiKey && !client.apiKeyHash) data.apiKeyHash = hashSecret(client.apiKey)
    if (client.detectToken && !client.detectTokenHash) data.detectTokenHash = hashSecret(client.detectToken)
    if (client.webhookSecret && !client.webhookSecretHash) data.webhookSecretHash = hashSecret(client.webhookSecret)
    if (Object.keys(data).length > 0) {
      await prisma.client.update({ where: { id: client.id }, data })
    }
  }

  const transactions = await prisma.transaction.findMany({
    where: { OR: [{ amountCents: null }, { detectedAmountCents: null }] },
  })
  for (const tx of transactions) {
    await prisma.transaction.update({
      where: { id: tx.id },
      data: {
        amountCents: tx.amountCents ?? toCents(tx.amountEgp),
        detectedAmountCents: tx.detectedAmountCents ?? (tx.detectedAmountEgp == null ? null : toCents(tx.detectedAmountEgp)),
      },
    })
  }

  const mismatches = await prisma.mismatchedPayment.findMany({
    where: { amountCents: null },
  })
  for (const payment of mismatches) {
    await prisma.mismatchedPayment.update({
      where: { id: payment.id },
      data: { amountCents: toCents(payment.amountEgp) },
    })
  }

  console.log(`[backfill] clients=${clients.length} transactions=${transactions.length} mismatches=${mismatches.length}`)
} finally {
  await prisma.$disconnect()
}
