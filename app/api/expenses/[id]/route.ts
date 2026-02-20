import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPersonalLimitInfo, getTotalLimitInfo } from "@/lib/limit";

// PUT - 사용 내역 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const expense = await prisma.expense.findUnique({ where: { id: params.id } });
    if (!expense) {
      return NextResponse.json({ error: "내역을 찾을 수 없습니다." }, { status: 404 });
    }
    if (expense.userId !== session.user.id) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    const { amount, usedAt, merchant, memo } = await request.json();

    if (!amount || typeof amount !== "number" || amount <= 0) {
      return NextResponse.json({ error: "올바른 금액을 입력해주세요." }, { status: 400 });
    }

    // 기존 금액을 제외한 개인 잔여 한도 검증
    const { effectiveLimit } = await getPersonalLimitInfo(session.user.id);
    const myExpenses = await prisma.expense.aggregate({
      _sum: { amount: true },
      where: { userId: session.user.id, NOT: { id: params.id } },
    });
    const myUsedExcluding = myExpenses._sum.amount ?? 0;
    const remainingPersonal = effectiveLimit - myUsedExcluding;

    if (amount > remainingPersonal) {
      return NextResponse.json(
        {
          error: `개인 잔여 한도(${remainingPersonal.toLocaleString("ko-KR")}원)를 초과합니다.`,
          code: "PERSONAL_LIMIT_EXCEEDED",
        },
        { status: 400 }
      );
    }

    // 총 한도 검증 (기존 금액 제외)
    const { totalLimit } = await getTotalLimitInfo();
    const allExpenses = await prisma.expense.aggregate({
      _sum: { amount: true },
      where: { user: { isActive: true }, NOT: { id: params.id } },
    });
    const totalUsedExcluding = allExpenses._sum.amount ?? 0;
    const totalRemaining = totalLimit - totalUsedExcluding;

    if (amount > totalRemaining) {
      return NextResponse.json(
        { error: `총 잔여 한도(${totalRemaining.toLocaleString("ko-KR")}원)를 초과합니다.` },
        { status: 400 }
      );
    }

    const updated = await prisma.expense.update({
      where: { id: params.id },
      data: {
        amount,
        usedAt: usedAt ? new Date(usedAt) : expense.usedAt,
        merchant: merchant || null,
        memo: memo || null,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT expense error:", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

// DELETE - 사용 내역 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const expense = await prisma.expense.findUnique({ where: { id: params.id } });
    if (!expense) {
      return NextResponse.json({ error: "내역을 찾을 수 없습니다." }, { status: 404 });
    }
    if (expense.userId !== session.user.id) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    await prisma.expense.delete({ where: { id: params.id } });
    return NextResponse.json({ message: "삭제되었습니다." });
  } catch (error) {
    console.error("DELETE expense error:", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
