import { prisma } from "@/lib/prisma";

export const PERSONAL_LIMIT = 400000; // 인당 기본 한도 40만원
export const UNIT = 10000;            // 1만원 단위

// 특정 유저의 개인 실질 한도 및 잔여 한도 계산 (이번 달 기준)
export async function getPersonalLimitInfo(userId: string) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const [expenses, approvals, requests] = await Promise.all([
    // 본인 사용액 (이번 달만)
    prisma.expense.aggregate({
      _sum: { amount: true },
      where: { userId, usedAt: { gte: startOfMonth, lte: endOfMonth } },
    }),
    // 내가 승인해준 금액 합계 (PARTIAL, FULFILLED, RETURNED 요청에 속한 내 승인)
    prisma.limitApproval.findMany({
      where: {
        approverId: userId,
        request: { status: { in: ["PARTIAL", "FULFILLED", "RETURNED"] } },
      },
      select: { amount: true, returnedAmount: true, request: { select: { status: true } } },
    }),
    // 내가 요청해서 충족된 금액 합계 (PARTIAL 포함)
    prisma.limitRequest.findMany({
      where: {
        requesterId: userId,
        status: { in: ["PARTIAL", "FULFILLED", "RETURNED"] },
      },
      select: {
        requestedAmount: true,
        approvedTotal: true,
        usedAmount: true,
        status: true,
        approvals: { select: { amount: true, returnedAmount: true } },
      },
    }),
  ]);

  const totalUsed = expenses._sum.amount ?? 0;

  // 내가 다른 사람에게 승인해준 금액 (내 한도에서 차감)
  // RETURNED 상태면 returnedAmount만큼 돌려받음
  const givenAmount = approvals.reduce((sum, a) => {
    if (a.request.status === "RETURNED") {
      return sum + a.amount - a.returnedAmount;
    }
    return sum + a.amount;
  }, 0);

  // 내가 요청해서 받은 추가 한도
  // RETURNED: 실제 사용분(usedAmount)만 인정
  // PARTIAL: 현재까지 승인된 금액(approvedTotal)만 인정 (계속 모집 중)
  // FULFILLED: 전체 요청 금액(requestedAmount) 인정
  const receivedAmount = requests.reduce((sum, r) => {
    if (r.status === "RETURNED") {
      return sum + r.usedAmount;
    }
    if (r.status === "PARTIAL") {
      return sum + r.approvedTotal;
    }
    return sum + r.requestedAmount;
  }, 0);

  const effectiveLimit = PERSONAL_LIMIT + receivedAmount - givenAmount;
  const remainingPersonal = effectiveLimit - totalUsed;

  return { totalUsed, effectiveLimit, remainingPersonal, givenAmount, receivedAmount };
}

// 총 잔여 한도 계산 (TEAM 모드 사용자만 포함)
export async function getTotalLimitInfo() {
  const [activeCount, totalExpenses] = await Promise.all([
    prisma.user.count({ where: { isActive: true, mode: "TEAM" } }),
    prisma.expense.aggregate({
      _sum: { amount: true },
      where: { user: { isActive: true, mode: "TEAM" } },
    }),
  ]);

  const totalLimit = PERSONAL_LIMIT * activeCount;
  const totalUsed = totalExpenses._sum.amount ?? 0;
  const remainingTotal = totalLimit - totalUsed;

  return { totalLimit, totalUsed, remainingTotal, totalMembers: activeCount };
}
