ALTER TABLE "Bounty" ADD COLUMN "txHash" TEXT;
ALTER TABLE "Bounty" ADD COLUMN "stellarExplorerUrl" TEXT;

CREATE UNIQUE INDEX "Bounty_txHash_key" ON "Bounty"("txHash");
