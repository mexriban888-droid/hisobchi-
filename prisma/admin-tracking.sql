-- Additive migration: no existing rows or financial data are deleted or reset.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "botStartedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "miniAppFirstOpenedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "miniAppLastOpenedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "accessRequestedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "accessRequestStatus" TEXT;
ALTER TABLE "SubscriptionEvent" ADD COLUMN IF NOT EXISTS "requestKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "SubscriptionEvent_requestKey_key" ON "SubscriptionEvent"("requestKey");
