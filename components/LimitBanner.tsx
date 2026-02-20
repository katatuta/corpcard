"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Summary {
  remainingTotal: number;
  usageRate: number;
}

export default function LimitBanner() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [summaryRes, requestsRes] = await Promise.all([
          fetch("/api/dashboard/summary"),
          fetch("/api/limit-requests?type=others"),
        ]);
        if (summaryRes.ok) setSummary(await summaryRes.json());
        if (requestsRes.ok) {
          const data = await requestsRes.json();
          // 내가 아직 승인하지 않은 OPEN 요청 수
          const unapproved = Array.isArray(data)
            ? data.filter((r: { myApproval?: unknown }) => !r.myApproval).length
            : 0;
          setPendingCount(unapproved);
        }
      } catch {}
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!summary) return null;

  return (
    <div className="space-y-2">
      {/* 승인 대기 중인 허가 요청 알림 */}
      {pendingCount > 0 && (
        <button
          onClick={() => router.push("/limit-requests")}
          className="w-full text-left bg-blue-50 border border-blue-200 text-blue-700 rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-blue-100 transition-colors"
        >
          🔔 승인 가능한 한도 요청이 {pendingCount}건 있습니다. 확인하기 →
        </button>
      )}

      {/* 총 한도 경고 */}
      {summary.usageRate >= 100 && (
        <div className="bg-red-50 border border-red-300 text-red-700 rounded-xl px-4 py-2.5 text-sm font-medium">
          ⛔ 총 한도 소진 — 신규 사용 내역 입력이 불가합니다.
        </div>
      )}
      {summary.usageRate >= 80 && summary.usageRate < 100 && (
        <div className="bg-orange-50 border border-orange-300 text-orange-700 rounded-xl px-4 py-2.5 text-sm font-medium">
          ⚠️ 총 한도의 {summary.usageRate}% 소진 — 잔여{" "}
          {summary.remainingTotal.toLocaleString("ko-KR")}원
        </div>
      )}
    </div>
  );
}
