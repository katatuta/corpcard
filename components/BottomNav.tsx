"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

const teamNavItems = [
  { href: "/expenses", label: "내 사용 내역", icon: "💳" },
  { href: "/dashboard", label: "한도 현황", icon: "📊" },
  { href: "/limit-requests", label: "허가 요청", icon: "🔄" },
];

const soloNavItems = [
  { href: "/expenses", label: "내 사용 내역", icon: "💳" },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const isSolo = session?.user?.mode === "SOLO";

  const navItems = isSolo ? soloNavItems : teamNavItems;
  const allItems = !isSolo && isAdmin
    ? [...navItems, { href: "/admin", label: "관리자", icon: "⚙️" }]
    : navItems;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 flex">
      {allItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs font-medium transition-colors ${
              isActive
                ? "text-blue-600"
                : "text-gray-500 active:bg-gray-100"
            }`}
          >
            <span className="text-xl leading-tight">{item.icon}</span>
            <span className="leading-tight">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
