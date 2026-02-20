/*
  Warnings:

  - The values [PENDING,APPROVED,REJECTED] on the enum `RequestStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `amount` on the `limit_requests` table. All the data in the column will be lost.
  - You are about to drop the column `approvedAt` on the `limit_requests` table. All the data in the column will be lost.
  - You are about to drop the column `approverId` on the `limit_requests` table. All the data in the column will be lost.
  - Added the required column `requestedAmount` to the `limit_requests` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "RequestStatus_new" AS ENUM ('OPEN', 'FULFILLED', 'CANCELLED', 'RETURNED');
ALTER TABLE "public"."limit_requests" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "limit_requests" ALTER COLUMN "status" TYPE "RequestStatus_new" USING ("status"::text::"RequestStatus_new");
ALTER TYPE "RequestStatus" RENAME TO "RequestStatus_old";
ALTER TYPE "RequestStatus_new" RENAME TO "RequestStatus";
DROP TYPE "public"."RequestStatus_old";
ALTER TABLE "limit_requests" ALTER COLUMN "status" SET DEFAULT 'OPEN';
COMMIT;

-- DropForeignKey
ALTER TABLE "limit_requests" DROP CONSTRAINT "limit_requests_approverId_fkey";

-- AlterTable
ALTER TABLE "limit_requests" DROP COLUMN "amount",
DROP COLUMN "approvedAt",
DROP COLUMN "approverId",
ADD COLUMN     "approvedTotal" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "fulfilledAt" TIMESTAMP(3),
ADD COLUMN     "requestedAmount" INTEGER NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'OPEN';

-- CreateTable
CREATE TABLE "limit_approvals" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "returnedAmount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "limit_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "limit_approvals_requestId_approverId_key" ON "limit_approvals"("requestId", "approverId");

-- AddForeignKey
ALTER TABLE "limit_approvals" ADD CONSTRAINT "limit_approvals_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "limit_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "limit_approvals" ADD CONSTRAINT "limit_approvals_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
