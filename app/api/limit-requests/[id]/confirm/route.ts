import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST - 부분 승인 확정 (요청자 본인만, OPEN 상태 + approvedTotal > 0)
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
    });

    if (!limitRequest) {
      return NextResponse.json({ error: "요청을 찾을 수 없습니다." }, { status: 404 });
    }
    if (limitRequest.requesterId !== session.user.id) {
      return NextResponse.json({ error: "본인의 요청만 확정할 수 있습니다." }, { status: 403 });
    }
    if (limitRequest.status !== "OPEN") {
      return NextResponse.json({ error: "진행 중인 요청만 확정할 수 있습니다." }, { status: 400 });
    }
    if (limitRequest.approvedTotal <= 0) {
      return NextResponse.json({ error: "승인된 금액이 없습니다." }, { status: 400 });
    }

    const updated = await prisma.limitRequest.update({
      where: { id: params.id },
      data: {
        status: "PARTIAL",
        fulfilledAt: new Date(),
      },
    });

    return NextResponse.json({
      ...updated,
      message: `${limitRequest.approvedTotal.toLocaleString("ko-KR")}원으로 부분 확정되었습니다. 나머지 금액은 계속 모집됩니다.`,
    });
  } catch (error) {
    console.error("Confirm error:", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
