import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import NavBar from "@/components/NavBar";
import BottomNav from "@/components/BottomNav";
import LimitBanner from "@/components/LimitBanner";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* 사이드바 (PC 전용) */}
      <NavBar />

      {/* 메인 콘텐츠 */}
      <main className="flex-1 p-4 md:p-8 overflow-auto pb-20 md:pb-8">
        <div className="max-w-4xl mx-auto space-y-4">
          <LimitBanner />
          {children}
        </div>
      </main>

      {/* 하단 탭바 (모바일 전용) */}
      <BottomNav />
    </div>
  );
}
