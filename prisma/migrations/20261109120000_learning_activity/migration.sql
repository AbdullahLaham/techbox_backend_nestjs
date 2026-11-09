-- CreateTable
CREATE TABLE "LearningActivity" (
    "userId" TEXT NOT NULL,
    "bucketStart" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningActivity_pkey" PRIMARY KEY ("userId","bucketStart")
);

-- AddForeignKey
ALTER TABLE "LearningActivity" ADD CONSTRAINT "LearningActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill from the history that already exists (only the first and last update of each
-- lesson progress row are known). Same sources as the live writes: video / reading progress
-- saved by the student, assignment submissions, quiz attempts. Progress rows of assignment
-- lessons are left out: a grader writes them, not the student.
INSERT INTO "LearningActivity" ("userId", "bucketStart")
SELECT DISTINCT a."userId",
       date_trunc('hour', a.at) + floor(extract(minute FROM a.at) / 15) * interval '15 minutes'
FROM (
    SELECT pl."userId", pl."createdAt" AS at
    FROM "ProgressLog" pl JOIN "ActivityNode" n ON n."id" = pl."nodeId"
    WHERE n."type" IN ('VIDEO_LECTURE', 'READING_MATERIAL')
    UNION ALL
    SELECT pl."userId", pl."updatedAt"
    FROM "ProgressLog" pl JOIN "ActivityNode" n ON n."id" = pl."nodeId"
    WHERE n."type" IN ('VIDEO_LECTURE', 'READING_MATERIAL')
    UNION ALL
    SELECT s."studentId", s."createdAt" FROM "Submission" s
    UNION ALL
    SELECT q."studentId", q."submittedAt" FROM "QuizAttempt" q
) a
ON CONFLICT DO NOTHING;
