ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "purpose" TEXT NOT NULL DEFAULT 'CHECKOUT';
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "subscriptionPlanName" TEXT;
CREATE INDEX IF NOT EXISTS "Transaction_clientId_purpose_status_idx" ON "Transaction"("clientId", "purpose", "status");
