import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PUT - 개인 월 한도 설정
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const { monthlyLimit } = await request.json();

    if (typeof monthlyLimit !== "number" || monthlyLimit <= 0 || !Number.isInteger(monthlyLimit)) {
      return NextResponse.json({ error: "올바른 한도 금액을 입력해주세요." }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: { monthlyLimit },
      select: { monthlyLimit: true },
    });

    return NextResponse.json({ monthlyLimit: updated.monthlyLimit });
  } catch (error) {
    console.error("PUT user/limit error:", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
