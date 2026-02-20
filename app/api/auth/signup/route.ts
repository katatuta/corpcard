import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  try {
    const { email, password, nickname } = await request.json();

    if (!email || !password || !nickname) {
      return NextResponse.json(
        { error: "이메일, 비밀번호, 가명은 필수입니다." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "비밀번호는 6자 이상이어야 합니다." },
        { status: 400 }
      );
    }

    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      return NextResponse.json(
        { error: "이미 사용 중인 이메일입니다." },
        { status: 409 }
      );
    }

    const existingNickname = await prisma.user.findUnique({ where: { nickname } });
    if (existingNickname) {
      return NextResponse.json(
        { error: "이미 사용 중인 가명입니다." },
        { status: 409 }
      );
    }

    // 첫 번째 사용자는 ADMIN
    const userCount = await prisma.user.count();
    const role = userCount === 0 ? "ADMIN" : "MEMBER";

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        nickname,
        role: role as "ADMIN" | "MEMBER",
      },
    });

    return NextResponse.json(
      { message: "회원가입이 완료되었습니다.", userId: user.id },
      { status: 201 }
    );
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
