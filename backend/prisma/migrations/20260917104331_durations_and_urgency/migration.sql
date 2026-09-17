-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "followUpDurationMinutes" INTEGER;

-- AlterTable
ALTER TABLE "SiteSetting" ADD COLUMN     "emergencyAlertChatIds" TEXT,
ADD COLUMN     "emergencyTransferPhone" TEXT,
ADD COLUMN     "operatorRingSeconds" INTEGER NOT NULL DEFAULT 25;
