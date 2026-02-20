import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PERSONAL_LIMIT } from "@/lib/limit";

// GET - 전체 참여자 목록 (관리자 전용)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "관리자만 접근할 수 있습니다." }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        email: true,
        nickname: true,
        role: true,
        isActive: true,
        createdAt: true,
        expenses: { select: { amount: true } },
        limitRequests: {
          where: { status: { in: ["FULFILLED", "RETURNED"] } },
          select: { requestedAmount: true, usedAmount: true, status: true },
        },
        limitApprovals: {
          where: { request: { status: { in: ["FULFILLED", "RETURNED"] } } },
          select: {
            amount: true,
            returnedAmount: true,
            request: { select: { status: true } },
          },
        },
      },
    });

    const members = users.map((u) => {
      const totalUsed = u.expenses.reduce((sum, e) => sum + e.amount, 0);
      const receivedAmount = u.limitRequests.reduce((sum, r) =>
        sum + (r.status === "RETURNED" ? r.usedAmount : r.requestedAmount), 0);
      const givenAmount = u.limitApprovals.reduce((sum, a) =>
        sum + (a.request.status === "RETURNED" ? a.amount - a.returnedAmount : a.amount), 0);
      const effectiveLimit = PERSONAL_LIMIT + receivedAmount - givenAmount;

      return {
        id: u.id,
        email: u.email,
        nickname: u.nickname,
        role: u.role,
        isActive: u.isActive,
        createdAt: u.createdAt,
        totalUsed,
        effectiveLimit,
        remainingPersonal: effectiveLimit - totalUsed,
      };
    });

    // 활성 참여자 수 & 총 한도 정보
    const activeCount = users.filter((u) => u.isActive).length;
    const totalLimit = PERSONAL_LIMIT * activeCount;
    const totalUsed = members
      .filter((m) => users.find((u) => u.id === m.id)?.isActive)
      .reduce((sum, m) => sum + m.totalUsed, 0);

    return NextResponse.json({
      members,
      summary: {
        activeCount,
        totalCount: users.length,
        totalLimit,
        totalUsed,
        remainingTotal: totalLimit - totalUsed,
      },
    });
  } catch (error) {
    console.error("Admin members GET error:", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
