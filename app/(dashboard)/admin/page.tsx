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
}

interface AdminSummary {
  activeCount: number;
  totalCount: number;
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

  // 관리자 아닌 경우 리다이렉트
  useEffect(() => {
    if (status === "authenticated" && session?.user?.role !== "ADMIN") {
      router.push("/expenses");
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">관리자</h1>
        <p className="text-sm text-gray-500 mt-1">참여자 계정을 관리하세요</p>
      </div>

      {/* 전체 현황 요약 */}
      {summary && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-500 mb-4">전체 현황</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-1">활성 참여자</p>
              <p className="text-xl font-bold text-gray-900">{summary.activeCount}명</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-1">전체 참여자</p>
              <p className="text-xl font-bold text-gray-900">{summary.totalCount}명</p>
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

            return (
              <div
                key={member.id}
                className={`px-6 py-4 ${!member.isActive ? "opacity-50" : ""} ${isMe ? "bg-blue-50" : ""}`}
              >
                <div className="flex items-center justify-between gap-4">
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
                    <p className="text-xs text-gray-400">{member.email} · 가입 {formatDate(member.createdAt)}</p>
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
    </div>
  );
}
