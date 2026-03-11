import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET - 전체 참여자 목록 (관리자 전용)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "관리자만 접근할 수 있습니다." }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        email: true,
        nickname: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    const activeCount = users.filter((u) => u.isActive).length;

    return NextResponse.json({
      members: users,
      summary: {
        activeCount,
        totalCount: users.length,
      },
    });
  } catch (error) {
    console.error("Admin members GET error:", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
