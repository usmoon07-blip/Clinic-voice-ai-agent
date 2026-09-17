-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "durationMinutes" INTEGER,
ADD COLUMN     "isUrgent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "urgentReason" TEXT;

-- AlterTable
ALTER TABLE "CallbackRequest" ADD COLUMN     "isEmergency" BOOLEAN NOT NULL DEFAULT false;
