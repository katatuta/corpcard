import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PERSONAL_LIMIT } from "@/lib/limit";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const activeUsers = await prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        nickname: true,
        expenses: { select: { amount: true } },
        // 내가 요청해서 충족/반환된 건
        limitRequests: {
          where: { status: { in: ["FULFILLED", "RETURNED"] } },
          select: { requestedAmount: true, usedAmount: true, status: true },
        },
        // 내가 승인해준 건
        limitApprovals: {
          where: {
            request: { status: { in: ["FULFILLED", "RETURNED"] } },
          },
          select: {
            amount: true,
            returnedAmount: true,
            request: { select: { status: true } },
          },
        },
      },
    });

    const totalMembers = activeUsers.length;
    const totalLimit = PERSONAL_LIMIT * totalMembers;

    const memberStats = activeUsers.map((user) => {
      const totalUsed = user.expenses.reduce((sum, e) => sum + e.amount, 0);

      // 요청해서 받은 추가 한도
      const receivedAmount = user.limitRequests.reduce((sum, r) => {
        if (r.status === "RETURNED") return sum + r.usedAmount;
        return sum + r.requestedAmount;
      }, 0);

      // 승인해준 금액 (차감, 반환분 제외)
      const givenAmount = user.limitApprovals.reduce((sum, a) => {
        if (a.request.status === "RETURNED") return sum + (a.amount - a.returnedAmount);
        return sum + a.amount;
      }, 0);

      const effectiveLimit = PERSONAL_LIMIT + receivedAmount - givenAmount;
      const remainingPersonal = effectiveLimit - totalUsed;

      return {
        id: user.id,
        nickname: user.nickname,
        totalUsed,
        effectiveLimit,
        remainingPersonal,
        receivedAmount,
        givenAmount,
        isMe: user.id === session.user.id,
      };
    });

    const totalUsed = memberStats.reduce((sum, m) => sum + m.totalUsed, 0);
    const remainingTotal = totalLimit - totalUsed;
    const usageRate = totalLimit > 0 ? Math.round((totalUsed / totalLimit) * 1000) / 10 : 0;

    return NextResponse.json({
      totalMembers,
      totalLimit,
      totalUsed,
      remainingTotal,
      usageRate,
      personalLimit: PERSONAL_LIMIT,
      members: memberStats,
    });
  } catch (error) {
    console.error("Dashboard summary error:", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
