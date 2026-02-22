import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const { token } = req.nextauth;
    const path = req.nextUrl.pathname;

    // SOLO 사용자: 팀 기능 페이지 접근 차단 → /expenses 리다이렉트
    if (token?.mode === "SOLO") {
      const blocked = ["/dashboard", "/limit-requests", "/admin"];
      if (blocked.some((p) => path.startsWith(p))) {
        return NextResponse.redirect(new URL("/expenses", req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: ["/dashboard/:path*", "/expenses/:path*", "/limit-requests/:path*", "/admin/:path*"],
};
