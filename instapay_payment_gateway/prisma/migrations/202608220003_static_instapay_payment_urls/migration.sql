ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "instapayPaymentUrl" TEXT;
CREATE INDEX IF NOT EXISTS "Client_instapayPaymentUrl_idx" ON "Client"("instapayPaymentUrl");
