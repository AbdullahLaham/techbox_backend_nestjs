-- AlterEnum
ALTER TYPE "EnrollmentStatus" ADD VALUE 'REJECTED';

-- DropIndex
DROP INDEX "Enrollment_programId_idx";

-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Enrollment_programId_status_idx" ON "Enrollment"("programId", "status");
