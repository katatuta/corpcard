import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UNIT } from "@/lib/limit";

// GET - 요청 목록 조회
// ?type=mine    : 내가 요청한 것
// ?type=others  : 내가 승인할 수 있는 것 (전체 공개, 본인 제외)
// ?type=all     : 둘 다 (기본)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const status = searchParams.get("status");

    const statusFilter = status ? { status: status as "OPEN" | "FULFILLED" | "CANCELLED" | "RETURNED" } : {};

    if (type === "mine") {
      const requests = await prisma.limitRequest.findMany({
        where: { requesterId: session.user.id, ...statusFilter },
        include: {
          approvals: {
            include: { approver: { select: { nickname: true } } },
          },
        },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json(requests);
    }

    if (type === "others") {
      // 전체 공개 요청 중 본인 요청 제외, OPEN 상태만
      const requests = await prisma.limitRequest.findMany({
        where: {
          requesterId: { not: session.user.id },
          status: "OPEN",
          ...statusFilter,
        },
        include: {
          requester: { select: { nickname: true } },
          approvals: {
            include: { approver: { select: { nickname: true } } },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      // 내가 이미 승인한 요청 표시
      const withMyApproval = requests.map((r) => ({
        ...r,
        myApproval: r.approvals.find((a) => a.approverId === session.user.id) ?? null,
      }));

      return NextResponse.json(withMyApproval);
    }

    // 기본: mine + others 둘 다
    const [mine, others] = await Promise.all([
      prisma.limitRequest.findMany({
        where: { requesterId: session.user.id },
        include: {
          approvals: {
            include: { approver: { select: { nickname: true } } },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.limitRequest.findMany({
        where: { requesterId: { not: session.user.id }, status: "OPEN" },
        include: {
          requester: { select: { nickname: true } },
          approvals: {
            include: { approver: { select: { nickname: true } } },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const othersWithMyApproval = others.map((r) => ({
      ...r,
      myApproval: r.approvals.find((a) => a.approverId === session.user.id) ?? null,
    }));

    return NextResponse.json({ mine, others: othersWithMyApproval });
  } catch (error) {
    console.error("GET limit-requests error:", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

// POST - 새 허가 요청 생성
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const { requestedAmount, reason } = await request.json();

    // 1만원 단위 검증
    if (!requestedAmount || requestedAmount <= 0) {
      return NextResponse.json({ error: "요청 금액을 입력해주세요." }, { status: 400 });
    }
    if (requestedAmount % UNIT !== 0) {
      return NextResponse.json({ error: "금액은 1만원 단위로 입력해주세요." }, { status: 400 });
    }

    // 총 잔여 한도 확인
    const { getTotalLimitInfo } = await import("@/lib/limit");
    const { remainingTotal } = await getTotalLimitInfo();
    if (requestedAmount > remainingTotal) {
      return NextResponse.json(
        { error: `총 잔여 한도(${remainingTotal.toLocaleString("ko-KR")}원)를 초과하는 금액은 요청할 수 없습니다.` },
        { status: 400 }
      );
    }

    // 이미 OPEN 상태인 내 요청이 있는지 확인
    const existingOpen = await prisma.limitRequest.findFirst({
      where: { requesterId: session.user.id, status: "OPEN" },
    });
    if (existingOpen) {
      return NextResponse.json(
        { error: "이미 진행 중인 허가 요청이 있습니다. 완료 또는 취소 후 새 요청을 보내세요." },
        { status: 409 }
      );
    }

    const limitRequest = await prisma.limitRequest.create({
      data: {
        requesterId: session.user.id,
        requestedAmount,
        reason: reason || null,
      },
      include: {
        approvals: true,
      },
    });

    return NextResponse.json(limitRequest, { status: 201 });
  } catch (error) {
    console.error("POST limit-request error:", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
