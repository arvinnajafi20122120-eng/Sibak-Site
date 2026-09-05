-- AddColumn groupId to TeacherContent
ALTER TABLE "TeacherContent" ADD COLUMN "groupId" TEXT NOT NULL DEFAULT '';

-- Create the foreign key constraint
ALTER TABLE "TeacherContent" ADD CONSTRAINT "TeacherContent_groupId_fkey" 
  FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add updatedAt column
ALTER TABLE "TeacherContent" ADD COLUMN "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Create unique index to prevent duplicate content titles per group per teacher
CREATE UNIQUE INDEX "TeacherContent_teacherId_groupId_title_key" ON "TeacherContent"("teacherId", "groupId", "title");
