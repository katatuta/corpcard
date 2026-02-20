import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Expense } from "@prisma/client";

type ExpenseWithUser = Expense & {
  user: { nickname: string };
};

// GET - 전체 사용 내역 CSV 다운로드
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "관리자만 접근할 수 있습니다." }, { status: 403 });
    }

    const expenses = await prisma.expense.findMany({
      orderBy: { usedAt: "desc" },
      include: {
        user: { select: { nickname: true } },
      },
    });

    const formatDate = (d: Date) => {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };

    const formatDateTime = (d: Date) => {
      return `${formatDate(d)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    };

    // CSV 헤더
    const header = ["가명", "금액(원)", "사용 일자", "사용처", "메모", "입력일시"].join(",");

    // CSV 행
    const rows = expenses.map((e: ExpenseWithUser) => {
      const cols = [
        e.user.nickname,
        e.amount.toString(),
        formatDate(e.usedAt),
        e.merchant ? `"${e.merchant.replace(/"/g, '""')}"` : "",
        e.memo ? `"${e.memo.replace(/"/g, '""')}"` : "",
        formatDateTime(e.createdAt),
      ];
      return cols.join(",");
    });

    const csv = [header, ...rows].join("\n");

    // BOM 추가 (Excel 한글 깨짐 방지)
    const bom = "\uFEFF";
    const csvWithBom = bom + csv;

    return new NextResponse(csvWithBom, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="corpcard_expenses_${formatDate(new Date())}.csv"`,
      },
    });
  } catch (error) {
    console.error("Export CSV error:", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
