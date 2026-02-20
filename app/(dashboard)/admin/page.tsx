"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface Member {
  id: string;
  email: string;
  nickname: string;
  role: "ADMIN" | "MEMBER";
  isActive: boolean;
  createdAt: string;
  totalUsed: number;
  effectiveLimit: number;
  remainingPersonal: number;
}

interface AdminSummary {
  activeCount: number;
  totalCount: number;
  totalLimit: number;
  totalUsed: number;
  remainingTotal: number;
}

function formatAmount(n: number) {
  return n.toLocaleString("ko-KR") + "원";
}

function formatDate(s: string) {
  const d = new Date(s);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [warningModal, setWarningModal] = useState<{
    memberId: string;
    message: string;
    currentTotalUsed: number;
    newTotalLimit: number;
  } | null>(null);

  // 관리자 아닌 경우 리다이렉트
  useEffect(() => {
    if (status === "authenticated" && session?.user?.role !== "ADMIN") {
      router.push("/dashboard");
    }
  }, [status, session, router]);

  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/members");
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members);
        setSummary(data.summary);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleToggleActive = async (memberId: string) => {
    setActionLoading(memberId);
    try {
      const res = await fetch(`/api/admin/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggleActive" }),
      });
      const data = await res.json();

      if (res.status === 409 && data.warning) {
        // 한도 초과 경고 모달
        setWarningModal({
          memberId,
          message: data.error,
          currentTotalUsed: data.currentTotalUsed,
          newTotalLimit: data.newTotalLimit,
        });
        return;
      }

      if (!res.ok) {
        alert(data.error || "처리에 실패했습니다.");
        return;
      }

      await fetchMembers();
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleRole = async (memberId: string) => {
    setActionLoading(memberId + "_role");
    try {
      const res = await fetch(`/api/admin/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggleRole" }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "처리에 실패했습니다.");
        return;
      }
      await fetchMembers();
    } finally {
      setActionLoading(null);
    }
  };

  const handleExportCSV = () => {
    window.open("/api/admin/export", "_blank");
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        불러오는 중...
      </div>
    );
  }

  if (session?.user?.role !== "ADMIN") return null;

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">관리자</h1>
          <p className="text-sm text-gray-500 mt-1">참여자 관리 및 데이터 내보내기</p>
        </div>
        <button
          onClick={handleExportCSV}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white text-sm font-medium rounded-lg transition-colors"
        >
          CSV 내보내기
        </button>
      </div>

      {/* 전체 현황 요약 */}
      {summary && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-500 mb-4">전체 현황</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-1">활성 참여자</p>
              <p className="text-xl font-bold text-gray-900">{summary.activeCount}명</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-1">총 한도</p>
              <p className="text-xl font-bold text-gray-900">{formatAmount(summary.totalLimit)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-1">총 사용액</p>
              <p className="text-xl font-bold text-blue-600">{formatAmount(summary.totalUsed)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-1">잔여 한도</p>
              <p className={`text-xl font-bold ${summary.remainingTotal <= 0 ? "text-red-600" : "text-green-600"}`}>
                {formatAmount(summary.remainingTotal)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 참여자 목록 */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-700">참여자 목록</h2>
          <span className="text-sm text-gray-400">총 {members.length}명</span>
        </div>

        <div className="divide-y divide-gray-100">
          {members.map((member) => {
            const isMe = member.id === session?.user?.id;
            const usageRate = member.effectiveLimit > 0
              ? Math.round((member.totalUsed / member.effectiveLimit) * 100)
              : 0;

            return (
              <div
                key={member.id}
                className={`px-6 py-4 ${!member.isActive ? "opacity-50" : ""} ${isMe ? "bg-blue-50" : ""}`}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* 좌측: 사용자 정보 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="font-semibold text-gray-900">{member.nickname}</span>
                      {isMe && (
                        <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">나</span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        member.role === "ADMIN"
                          ? "bg-purple-100 text-purple-700"
                          : "bg-gray-100 text-gray-600"
                      }`}>
                        {member.role === "ADMIN" ? "관리자" : "멤버"}
                      </span>
                      {!member.isActive && (
                        <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">비활성</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mb-2">{member.email} · 가입 {formatDate(member.createdAt)}</p>

                    {/* 사용량 바 */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-1.5 rounded-full ${usageRate >= 100 ? "bg-red-500" : usageRate >= 80 ? "bg-orange-400" : "bg-blue-500"}`}
                          style={{ width: `${Math.min(usageRate, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 shrink-0">
                        {formatAmount(member.totalUsed)} / {formatAmount(member.effectiveLimit)}
                      </span>
                    </div>
                  </div>

                  {/* 우측: 액션 버튼 */}
                  {!isMe && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleToggleRole(member.id)}
                        disabled={actionLoading === member.id + "_role"}
                        className="text-xs px-3 py-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {actionLoading === member.id + "_role"
                          ? "처리 중..."
                          : member.role === "ADMIN" ? "멤버로 변경" : "관리자로 변경"}
                      </button>
                      <button
                        onClick={() => handleToggleActive(member.id)}
                        disabled={actionLoading === member.id}
                        className={`text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                          member.isActive
                            ? "bg-red-50 text-red-600 hover:bg-red-100"
                            : "bg-green-50 text-green-700 hover:bg-green-100"
                        }`}
                      >
                        {actionLoading === member.id
                          ? "처리 중..."
                          : member.isActive ? "비활성화" : "활성화"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 한도 초과 경고 모달 */}
      {warningModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">⚠️ 한도 초과 경고</h3>
            <p className="text-sm text-gray-600 mb-4">{warningModal.message}</p>
            <div className="bg-orange-50 rounded-xl p-4 mb-5 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">현재 총 사용액</span>
                <span className="font-semibold text-gray-900">{formatAmount(warningModal.currentTotalUsed)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">변경 후 총 한도</span>
                <span className="font-semibold text-red-600">{formatAmount(warningModal.newTotalLimit)}</span>
              </div>
              <div className="flex justify-between border-t border-orange-200 pt-1 mt-1">
                <span className="text-gray-500">초과분</span>
                <span className="font-semibold text-red-600">
                  {formatAmount(warningModal.currentTotalUsed - warningModal.newTotalLimit)}
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-400 mb-5">
              비활성화 후 신규 사용 내역 입력이 차단됩니다. 기존 내역은 유지됩니다.
            </p>
            <div className="flex gap-3">
              <button
                onClick={async () => {
                  const id = warningModal.memberId;
                  setWarningModal(null);
                  // 경고를 확인하고 강제 비활성화 — 별도 force 파라미터 없이 서버에서 바로 처리
                  setActionLoading(id);
                  try {
                    // 한도 초과 상태에서도 비활성화 가능하도록 별도 엔드포인트 없이
                    // 관리자가 확인 후 직접 DB 조작 대신 force flag로 재요청
                    await fetch(`/api/admin/members/${id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "toggleActive", force: true }),
                    });
                    await fetchMembers();
                  } finally {
                    setActionLoading(null);
                  }
                }}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg text-sm transition-colors"
              >
                그래도 비활성화
              </button>
              <button
                onClick={() => setWarningModal(null)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg text-sm transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
