/*
  Warnings:

  - You are about to drop the column `milestone_completion_pct` on the `accounts` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "accounts" DROP COLUMN "milestone_completion_pct",
ADD COLUMN     "career_milestone_completion_pct" DOUBLE PRECISION,
ADD COLUMN     "college_milestone_completion_pct" DOUBLE PRECISION,
ADD COLUMN     "common_app_linking" DOUBLE PRECISION;
