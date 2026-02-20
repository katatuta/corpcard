export { default } from "next-auth/middleware";

export const config = {
  matcher: ["/dashboard/:path*", "/expenses/:path*", "/limit-requests/:path*", "/admin/:path*"],
};
