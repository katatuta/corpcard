import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import NavBar from "@/components/NavBar";
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
      {/* 사이드바 */}
      <NavBar />

      {/* 메인 콘텐츠 */}
      <main className="flex-1 p-8 overflow-auto">
        <div className="max-w-4xl mx-auto space-y-4">
          <LimitBanner />
          {children}
        </div>
      </main>
    </div>
  );
}
