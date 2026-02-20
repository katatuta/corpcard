import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST - 미사용분 반환 (요청자 본인만, FULFILLED 상태만)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const limitRequest = await prisma.limitRequest.findUnique({
      where: { id: params.id },
      include: {
        approvals: {
          include: { approver: { select: { nickname: true } } },
        },
      },
    });

    if (!limitRequest) {
      return NextResponse.json({ error: "요청을 찾을 수 없습니다." }, { status: 404 });
    }
    if (limitRequest.requesterId !== session.user.id) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }
    if (limitRequest.status !== "FULFILLED") {
      return NextResponse.json({ error: "충족된 요청만 반환할 수 있습니다." }, { status: 400 });
    }

    // 충족 시각 이후 실제 사용한 금액 계산
    const usedAfter = await prisma.expense.aggregate({
      _sum: { amount: true },
      where: {
        userId: session.user.id,
        createdAt: { gte: limitRequest.fulfilledAt! },
      },
    });

    // 실사용분은 requestedAmount 초과 불가
    const actualUsed = Math.min(
      usedAfter._sum.amount ?? 0,
      limitRequest.requestedAmount
    );
    const totalToReturn = limitRequest.requestedAmount - actualUsed;

    // 승인자별 비례 반환 계산
    // 각 승인자가 승인한 금액 비율대로 반환
    const approvalUpdates = limitRequest.approvals.map((approval) => {
      const ratio = approval.amount / limitRequest.approvedTotal;
      const returnedAmount = Math.round(totalToReturn * ratio);
      return { id: approval.id, returnedAmount };
    });

    // 트랜잭션으로 일괄 처리
    await prisma.$transaction([
      // 각 승인 건의 반환 금액 기록
      ...approvalUpdates.map((u) =>
        prisma.limitApproval.update({
          where: { id: u.id },
          data: { returnedAmount: u.returnedAmount },
        })
      ),
      // 요청 상태 업데이트
      prisma.limitRequest.update({
        where: { id: params.id },
        data: {
          status: "RETURNED",
          usedAmount: actualUsed,
          returnedAt: new Date(),
        },
      }),
    ]);

    return NextResponse.json({
      message: `${totalToReturn.toLocaleString("ko-KR")}원이 승인자들에게 반환되었습니다.`,
      actualUsed,
      totalToReturn,
      breakdown: approvalUpdates,
    });
  } catch (error) {
    console.error("Return error:", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
