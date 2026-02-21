"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

const navItems = [
  { href: "/expenses", label: "내 사용 내역", icon: "💳" },
  { href: "/dashboard", label: "전체 한도 현황", icon: "📊" },
  { href: "/limit-requests", label: "허가 요청", icon: "🔄" },
];

export default function NavBar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <aside className="hidden md:flex w-56 shrink-0 bg-white border-r border-gray-200 min-h-screen flex-col">
      {/* 로고 */}
      <div className="px-5 py-5 border-b border-gray-100">
        <h1 className="text-lg font-bold text-gray-900">법인카드 관리</h1>
        <p className="text-xs text-gray-400 mt-0.5 truncate">{session?.user?.nickname}</p>
      </div>

      {/* 메뉴 */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-blue-50 text-blue-600"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}

        {isAdmin && (
          <Link
            href="/admin"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              pathname === "/admin"
                ? "bg-blue-50 text-blue-600"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <span>⚙️</span>
            <span>관리자</span>
          </Link>
        )}
      </nav>

      {/* 로그아웃 */}
      <div className="px-3 py-4 border-t border-gray-100">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <span>🚪</span>
          <span>로그아웃</span>
        </button>
      </div>
    </aside>
  );
}
