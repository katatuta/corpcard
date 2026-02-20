"use client";

import { useEffect, useState, useCallback } from "react";

const PERSONAL_LIMIT = 400000;

interface MemberStat {
  id: string;
  nickname: string;
  totalUsed: number;
  effectiveLimit: number;
  remainingPersonal: number;
  grantedExtra: number;
  givenExtra: number;
  isMe: boolean;
}

interface Summary {
  totalMembers: number;
  totalLimit: number;
  totalUsed: number;
  remainingTotal: number;
  usageRate: number;
  personalLimit: number;
  members: MemberStat[];
}

function formatAmount(amount: number) {
  return amount.toLocaleString("ko-KR") + "원";
}

function ProgressBar({ rate }: { rate: number }) {
  const clamped = Math.min(rate, 100);
  const color =
    rate >= 100 ? "bg-red-500" : rate >= 80 ? "bg-orange-400" : "bg-blue-500";

  return (
    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
      <div
        className={`h-3 rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/summary");
      if (!res.ok) throw new Error("데이터를 불러오지 못했습니다.");
      const data = await res.json();
      setSummary(data);
    } catch {
      setError("데이터를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
    // 30초마다 자동 갱신
    const interval = setInterval(fetchSummary, 30000);
    return () => clearInterval(interval);
  }, [fetchSummary]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">불러오는 중...</div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">{error || "데이터를 불러올 수 없습니다."}</div>
      </div>
    );
  }

  const { totalMembers, totalLimit, totalUsed, remainingTotal, usageRate, members } = summary;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
        <p className="text-sm text-gray-500 mt-1">전체 한도 현황을 확인하세요</p>
      </div>

      {/* 경고 배너 */}
      {usageRate >= 100 && (
        <div className="bg-red-50 border border-red-300 text-red-700 rounded-xl px-5 py-3 text-sm font-medium">
          ⛔ 총 한도가 소진되었습니다. 신규 사용 내역 입력이 불가합니다.
        </div>
      )}
      {usageRate >= 80 && usageRate < 100 && (
        <div className="bg-orange-50 border border-orange-300 text-orange-700 rounded-xl px-5 py-3 text-sm font-medium">
          ⚠️ 총 한도의 {usageRate}%가 소진되었습니다. 잔여 한도를 확인하세요.
        </div>
      )}

      {/* 총 한도 카드 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-700">총 한도 현황</h2>
          <span className="text-sm text-gray-400">{totalMembers}명 × {formatAmount(PERSONAL_LIMIT)}</span>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-5">
          <div className="text-center">
            <p className="text-xs text-gray-400 mb-1">총 한도</p>
            <p className="text-xl font-bold text-gray-900">{formatAmount(totalLimit)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-400 mb-1">총 사용액</p>
            <p className="text-xl font-bold text-blue-600">{formatAmount(totalUsed)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-400 mb-1">잔여 한도</p>
            <p className={`text-xl font-bold ${remainingTotal <= 0 ? "text-red-600" : "text-green-600"}`}>
              {formatAmount(remainingTotal)}
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-gray-500">
            <span>소진율</span>
            <span className={usageRate >= 80 ? "text-orange-500 font-semibold" : ""}>{usageRate}%</span>
          </div>
          <ProgressBar rate={usageRate} />
        </div>
      </div>

      {/* 참여자별 현황 */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-700">참여자별 현황</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {members.map((member) => {
            const personalRate =
              member.effectiveLimit > 0
                ? (member.totalUsed / member.effectiveLimit) * 100
                : 0;

            return (
              <div
                key={member.id}
                className={`px-6 py-4 ${member.isMe ? "bg-blue-50" : ""}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-800">{member.nickname}</span>
                    {member.isMe && (
                      <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium">
                        나
                      </span>
                    )}
                    {/* 허가 현황 뱃지 */}
                    {member.grantedExtra > 0 && (
                      <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full">
                        +{formatAmount(member.grantedExtra)} 허가받음
                      </span>
                    )}
                    {member.givenExtra > 0 && (
                      <span className="text-xs bg-yellow-100 text-yellow-600 px-2 py-0.5 rounded-full">
                        -{formatAmount(member.givenExtra)} 허가해줌
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-gray-900">
                      {formatAmount(member.totalUsed)}
                    </span>
                    <span className="text-xs text-gray-400 ml-1">
                      / {formatAmount(member.effectiveLimit)}
                    </span>
                  </div>
                </div>

                {/* 개인 소진율 바 */}
                <div className="space-y-1">
                  <ProgressBar rate={personalRate} />
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>잔여 {formatAmount(member.remainingPersonal)}</span>
                    <span>{Math.round(personalRate)}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
