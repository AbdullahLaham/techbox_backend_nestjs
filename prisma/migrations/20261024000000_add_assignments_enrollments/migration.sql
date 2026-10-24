-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- AlterEnum
ALTER TYPE "EnrollmentStatus" ADD VALUE 'PENDING';

-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "age" INTEGER,
ADD COLUMN     "fullNameAr" TEXT,
ADD COLUMN     "fullNameEn" TEXT,
ADD COLUMN     "governorate" TEXT,
ADD COLUMN     "nationalId" TEXT,
ADD COLUMN     "phoneWhatsApp" TEXT;

-- AlterTable
ALTER TABLE "Program" ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "isEnrollmentOpen" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "maxSeats" INTEGER DEFAULT 30,
ADD COLUMN     "startDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "status" "AssignmentStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN     "paymentReceipt" TEXT,
ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "AssignmentAttachment" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssignmentAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssignmentAttachment_storageKey_key" ON "AssignmentAttachment"("storageKey");

-- CreateIndex
CREATE INDEX "AssignmentAttachment_assignmentId_idx" ON "AssignmentAttachment"("assignmentId");

-- CreateIndex
CREATE INDEX "Assignment_status_idx" ON "Assignment"("status");

-- AddForeignKey
ALTER TABLE "AssignmentAttachment" ADD CONSTRAINT "AssignmentAttachment_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
