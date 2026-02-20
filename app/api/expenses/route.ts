import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPersonalLimitInfo, getTotalLimitInfo } from "@/lib/limit";

// GET - 내 사용 내역 조회
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const [expenses, limitInfo] = await Promise.all([
      prisma.expense.findMany({
        where: { userId: session.user.id },
        orderBy: { usedAt: "desc" },
      }),
      getPersonalLimitInfo(session.user.id),
    ]);

    return NextResponse.json({
      expenses,
      totalUsed: limitInfo.totalUsed,
      effectiveLimit: limitInfo.effectiveLimit,
      remainingPersonal: limitInfo.remainingPersonal,
    });
  } catch (error) {
    console.error("GET expenses error:", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

// POST - 사용 내역 추가
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const { amount, usedAt, merchant, memo } = await request.json();

    if (!amount || typeof amount !== "number" || amount <= 0) {
      return NextResponse.json({ error: "올바른 금액을 입력해주세요." }, { status: 400 });
    }

    // 1. 개인 실질 잔여 한도 검증
    const { remainingPersonal } = await getPersonalLimitInfo(session.user.id);
    if (amount > remainingPersonal) {
      return NextResponse.json(
        {
          error: `개인 잔여 한도(${remainingPersonal.toLocaleString("ko-KR")}원)를 초과합니다. 허가 요청 탭에서 한도 요청을 보내세요.`,
          code: "PERSONAL_LIMIT_EXCEEDED",
          remainingPersonal,
        },
        { status: 400 }
      );
    }

    // 2. 총 잔여 한도 검증
    const { remainingTotal } = await getTotalLimitInfo();
    if (amount > remainingTotal) {
      return NextResponse.json(
        {
          error: `총 잔여 한도(${remainingTotal.toLocaleString("ko-KR")}원)를 초과합니다.`,
          code: "TOTAL_LIMIT_EXCEEDED",
          remainingTotal,
        },
        { status: 400 }
      );
    }

    const expense = await prisma.expense.create({
      data: {
        userId: session.user.id,
        amount,
        usedAt: usedAt ? new Date(usedAt) : new Date(),
        merchant: merchant || null,
        memo: memo || null,
      },
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    console.error("POST expense error:", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
