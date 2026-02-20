import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPersonalLimitInfo, UNIT } from "@/lib/limit";

// POST - 허가 요청에 승인 금액 추가/수정
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const { requestId, amount } = await request.json();

    if (!requestId) {
      return NextResponse.json({ error: "요청 ID가 필요합니다." }, { status: 400 });
    }
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "승인 금액을 입력해주세요." }, { status: 400 });
    }
    if (amount % UNIT !== 0) {
      return NextResponse.json({ error: "금액은 1만원 단위로 입력해주세요." }, { status: 400 });
    }

    // 요청 조회
    const limitRequest = await prisma.limitRequest.findUnique({
      where: { id: requestId },
      include: { approvals: true },
    });

    if (!limitRequest) {
      return NextResponse.json({ error: "요청을 찾을 수 없습니다." }, { status: 404 });
    }
    if (limitRequest.requesterId === session.user.id) {
      return NextResponse.json({ error: "본인의 요청에는 승인할 수 없습니다." }, { status: 400 });
    }
    if (limitRequest.status !== "OPEN") {
      return NextResponse.json({ error: "모집 중인 요청에만 승인할 수 있습니다." }, { status: 400 });
    }

    // 내 개인 잔여 한도 확인
    const { remainingPersonal } = await getPersonalLimitInfo(session.user.id);

    // 이미 내가 승인한 금액이 있으면 차감 후 비교
    const myExisting = limitRequest.approvals.find(
      (a) => a.approverId === session.user.id
    );
    const myExistingAmount = myExisting?.amount ?? 0;
    const netNew = amount - myExistingAmount; // 추가로 필요한 금액

    if (netNew > remainingPersonal) {
      return NextResponse.json(
        {
          error: `개인 잔여 한도(${remainingPersonal.toLocaleString("ko-KR")}원)가 부족합니다.`,
          remainingPersonal,
        },
        { status: 400 }
      );
    }

    // 기존 승인 합계에서 내 기존 승인 제거
    const currentTotalExcludingMe = limitRequest.approvedTotal - myExistingAmount;

    // 요청 잔여분 계산 — 절대로 requestedAmount를 초과할 수 없음
    const requestRemaining = limitRequest.requestedAmount - currentTotalExcludingMe;
    if (requestRemaining <= 0) {
      return NextResponse.json(
        { error: "이미 다른 참여자들의 승인으로 요청이 충족되었습니다." },
        { status: 400 }
      );
    }

    // 실제 승인 금액: 요청 잔여분을 초과하면 잔여분으로 클리핑
    const actualAmount = Math.min(amount, requestRemaining);
    const newApprovedTotal = currentTotalExcludingMe + actualAmount;

    // 트랜잭션: 승인 upsert + 요청 상태 업데이트
    const result = await prisma.$transaction(async (tx) => {
      // LimitApproval upsert (클리핑된 actualAmount 저장)
      const approval = await tx.limitApproval.upsert({
        where: {
          requestId_approverId: {
            requestId,
            approverId: session.user.id,
          },
        },
        update: { amount: actualAmount },
        create: {
          requestId,
          approverId: session.user.id,
          amount: actualAmount,
        },
      });

      // 요청 상태 업데이트 (approvedTotal은 requestedAmount를 절대 초과하지 않음)
      const isFulfilled = newApprovedTotal >= limitRequest.requestedAmount;
      const updatedRequest = await tx.limitRequest.update({
        where: { id: requestId },
        data: {
          approvedTotal: newApprovedTotal,
          status: isFulfilled ? "FULFILLED" : "OPEN",
          fulfilledAt: isFulfilled ? new Date() : null,
        },
        include: {
          approvals: {
            include: { approver: { select: { nickname: true } } },
          },
          requester: { select: { nickname: true } },
        },
      });

      return { approval, request: updatedRequest, isFulfilled, actualAmount };
    });

    // 요청한 금액과 실제 승인된 금액이 다를 경우 안내
    const clipped = actualAmount < amount;
    const clipNote = clipped
      ? ` (요청 잔여분이 ${(requestRemaining / UNIT).toFixed(0)}만원이어서 자동 조정되었습니다)`
      : "";

    return NextResponse.json({
      ...result,
      message: result.isFulfilled
        ? `🎉 요청이 충족되었습니다! ${limitRequest.requestedAmount.toLocaleString("ko-KR")}원을 사용할 수 있습니다.`
        : `${result.actualAmount.toLocaleString("ko-KR")}원 승인 완료${clipNote}. 현재 ${newApprovedTotal.toLocaleString("ko-KR")}원 / ${limitRequest.requestedAmount.toLocaleString("ko-KR")}원`,
    });
  } catch (error) {
    console.error("POST limit-approval error:", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
