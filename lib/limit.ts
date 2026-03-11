import { prisma } from "@/lib/prisma";

export const PERSONAL_LIMIT = 400000; // 인당 기본 한도 40만원
export const UNIT = 10000;            // 1만원 단위

// 특정 유저의 개인 실질 한도 및 잔여 한도 계산 (이번 달 기준, 한도 공유 없음)
export async function getPersonalLimitInfo(userId: string) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  // 유저의 개인 한도 및 이번 달 사용액 조회
  const [user, expenses] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { monthlyLimit: true } }),
    prisma.expense.aggregate({
      _sum: { amount: true },
      where: { userId, usedAt: { gte: startOfMonth, lte: endOfMonth } },
    }),
  ]);

  const totalUsed = expenses._sum.amount ?? 0;
  const effectiveLimit = user?.monthlyLimit ?? PERSONAL_LIMIT;
  const remainingPersonal = effectiveLimit - totalUsed;

  return { totalUsed, effectiveLimit, monthlyLimit: effectiveLimit, remainingPersonal, givenAmount: 0, receivedAmount: 0 };
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
