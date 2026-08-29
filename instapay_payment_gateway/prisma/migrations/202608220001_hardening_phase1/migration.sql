-- Additive hardening migration. Safe to deploy before code cutover.

ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "apiKeyHash" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "detectTokenHash" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "apiKeyLastUsedAt" TIMESTAMP(3);
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "detectTokenLastUsedAt" TIMESTAMP(3);
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "webhookSecretHash" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Client_apiKeyHash_key" ON "Client"("apiKeyHash");
CREATE UNIQUE INDEX IF NOT EXISTS "Client_detectTokenHash_key" ON "Client"("detectTokenHash");
CREATE INDEX IF NOT EXISTS "Client_apiKeyHash_idx" ON "Client"("apiKeyHash");
CREATE INDEX IF NOT EXISTS "Client_detectTokenHash_idx" ON "Client"("detectTokenHash");

ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "amountCents" INTEGER;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "detectedAmountCents" INTEGER;
UPDATE "Transaction" SET "amountCents" = ROUND("amountEgp" * 100)::INTEGER WHERE "amountCents" IS NULL;
UPDATE "Transaction" SET "detectedAmountCents" = ROUND("detectedAmountEgp" * 100)::INTEGER WHERE "detectedAmountCents" IS NULL AND "detectedAmountEgp" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "Transaction_clientId_senderHandle_amountCents_status_idx" ON "Transaction"("clientId", "senderHandle", "amountCents", "status");

ALTER TABLE "MismatchedPayment" ADD COLUMN IF NOT EXISTS "amountCents" INTEGER;
UPDATE "MismatchedPayment" SET "amountCents" = ROUND("amountEgp" * 100)::INTEGER WHERE "amountCents" IS NULL;

ALTER TABLE "WebhookLog" ADD COLUMN IF NOT EXISTS "eventId" TEXT;
ALTER TABLE "WebhookLog" ADD COLUMN IF NOT EXISTS "attempt" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "WebhookLog" ADD COLUMN IF NOT EXISTS "nextAttemptAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "WebhookLog_eventId_idx" ON "WebhookLog"("eventId");
CREATE INDEX IF NOT EXISTS "WebhookLog_isSuccess_nextAttemptAt_idx" ON "WebhookLog"("isSuccess", "nextAttemptAt");

CREATE TABLE IF NOT EXISTS "DetectorDevice" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "appVersion" TEXT,
  "androidVersion" TEXT,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastIp" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DetectorDevice_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DetectorDevice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "DetectorDevice_clientId_deviceId_key" ON "DetectorDevice"("clientId", "deviceId");
CREATE INDEX IF NOT EXISTS "DetectorDevice_clientId_lastSeenAt_idx" ON "DetectorDevice"("clientId", "lastSeenAt");
