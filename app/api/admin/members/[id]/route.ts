import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PERSONAL_LIMIT } from "@/lib/limit";

// PATCH - 역할 변경 또는 활성/비활성 토글
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "관리자만 접근할 수 있습니다." }, { status: 403 });
    }
    if (params.id === session.user.id) {
      return NextResponse.json({ error: "본인 계정은 변경할 수 없습니다." }, { status: 400 });
    }

    const { action, force } = await request.json();
    // action: "toggleActive" | "toggleRole"
    // force: true → 경고 무시하고 강제 비활성화

    const target = await prisma.user.findUnique({ where: { id: params.id } });
    if (!target) {
      return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
    }

    if (action === "toggleActive") {
      const newIsActive = !target.isActive;

      // 비활성화 시 총 한도 축소 경고 검증 (force=true면 경고 스킵)
      if (!newIsActive && !force) {
        const currentActiveCount = await prisma.user.count({
          where: { isActive: true },
        });
        const newActiveCount = currentActiveCount - 1;
        const newTotalLimit = PERSONAL_LIMIT * newActiveCount;

        const totalExpenses = await prisma.expense.aggregate({
          _sum: { amount: true },
          where: { user: { isActive: true } },
        });
        const currentTotalUsed = totalExpenses._sum.amount ?? 0;

        if (currentTotalUsed > newTotalLimit) {
          return NextResponse.json(
            {
              error: `현재 총 사용액(${currentTotalUsed.toLocaleString("ko-KR")}원)이 변경 후 총 한도(${newTotalLimit.toLocaleString("ko-KR")}원)를 초과합니다. 비활성화하면 신규 내역 입력이 차단됩니다.`,
              warning: true,
              currentTotalUsed,
              newTotalLimit,
            },
            { status: 409 }
          );
        }
      }

      const updated = await prisma.user.update({
        where: { id: params.id },
        data: { isActive: newIsActive },
        select: { id: true, nickname: true, isActive: true, role: true },
      });
      return NextResponse.json(updated);
    }

    if (action === "toggleRole") {
      const newRole = target.role === "ADMIN" ? "MEMBER" : "ADMIN";
      const updated = await prisma.user.update({
        where: { id: params.id },
        data: { role: newRole },
        select: { id: true, nickname: true, isActive: true, role: true },
      });
      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: "올바르지 않은 액션입니다." }, { status: 400 });
  } catch (error) {
    console.error("Admin member PATCH error:", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
