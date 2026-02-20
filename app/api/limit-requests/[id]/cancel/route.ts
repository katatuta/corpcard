import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST - 요청 취소 (요청자 본인만 가능, OPEN 상태만)
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
      return NextResponse.json({ error: "본인의 요청만 취소할 수 있습니다." }, { status: 403 });
    }
    if (limitRequest.status !== "OPEN") {
      return NextResponse.json({ error: "진행 중인 요청만 취소할 수 있습니다." }, { status: 400 });
    }

    const updated = await prisma.limitRequest.update({
      where: { id: params.id },
      data: { status: "CANCELLED" },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Cancel error:", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
