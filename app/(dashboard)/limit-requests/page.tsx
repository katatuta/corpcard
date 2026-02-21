"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";

const UNIT = 10000;

interface Approval {
  id: string;
  approverId: string;
  amount: number;
  returnedAmount: number;
  createdAt: string;
  approver: { nickname: string };
}

interface LimitRequest {
  id: string;
  requestedAmount: number;
  approvedTotal: number;
  usedAmount: number;
  reason: string | null;
  status: "OPEN" | "FULFILLED" | "CANCELLED" | "RETURNED";
  fulfilledAt: string | null;
  returnedAt: string | null;
  createdAt: string;
  approvals: Approval[];
  requester?: { nickname: string };
  myApproval?: Approval | null;
}

interface PersonalInfo {
  remainingPersonal: number;
  effectiveLimit: number;
  totalUsed: number;
}

function formatAmount(n: number) {
  return n.toLocaleString("ko-KR") + "원";
}

function formatMan(n: number) {
  return (n / UNIT) + "만원";
}

function formatDate(s: string) {
  const d = new Date(s);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

const STATUS_INFO = {
  OPEN:      { label: "모집 중",  cls: "bg-blue-100 text-blue-700" },
  FULFILLED: { label: "충족",     cls: "bg-green-100 text-green-700" },
  CANCELLED: { label: "취소됨",   cls: "bg-gray-100 text-gray-500" },
  RETURNED:  { label: "반환완료", cls: "bg-gray-100 text-gray-500" },
};

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? Math.min((current / total) * 100, 100) : 0;
  const color = pct >= 100 ? "bg-green-500" : "bg-blue-400";
  return (
    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
      <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function LimitRequestsContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "mine" ? "mine" : "board";
  const [tab, setTab] = useState<"board" | "mine">(initialTab as "board" | "mine");

  const [mine, setMine] = useState<LimitRequest[]>([]);
  const [others, setOthers] = useState<LimitRequest[]>([]);
  const [personalInfo, setPersonalInfo] = useState<PersonalInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // 요청 생성 폼
  const [showForm, setShowForm] = useState(false);
  const [formAmount, setFormAmount] = useState("");
  const [formReason, setFormReason] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // 승인 입력
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approvalAmount, setApprovalAmount] = useState("");
  const [approvalError, setApprovalError] = useState("");
  const [approving, setApproving] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [reqRes, expRes] = await Promise.all([
        fetch("/api/limit-requests"),
        fetch("/api/expenses"),
      ]);
      if (reqRes.ok) {
        const data = await reqRes.json();
        setMine(data.mine ?? []);
        setOthers(data.others ?? []);
      }
      if (expRes.ok) {
        const data = await expRes.json();
        setPersonalInfo({
          remainingPersonal: data.remainingPersonal,
          effectiveLimit: data.effectiveLimit,
          totalUsed: data.totalUsed,
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // 요청 생성
  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    const manUnits = parseInt(formAmount, 10);
    if (!manUnits || manUnits <= 0) { setFormError("금액을 입력해주세요."); return; }
    const amount = manUnits * UNIT;
    setSubmitting(true);
    try {
      const res = await fetch("/api/limit-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestedAmount: amount, reason: formReason || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error || "요청에 실패했습니다."); return; }
      setShowForm(false);
      setFormAmount("");
      setFormReason("");
      setTab("mine");
      await fetchAll();
    } catch {
      setFormError("서버 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  // 요청 취소
  const handleCancel = async (id: string) => {
    await fetch(`/api/limit-requests/${id}/cancel`, { method: "POST" });
    await fetchAll();
  };

  // 반환
  const handleReturn = async (id: string) => {
    const res = await fetch(`/api/limit-requests/${id}/return`, { method: "POST" });
    const data = await res.json();
    if (res.ok) alert(data.message);
    else alert(data.error);
    await fetchAll();
  };

  // 승인 제출
  const handleApprove = async (requestId: string) => {
    setApprovalError("");
    const manUnits = parseInt(approvalAmount, 10);
    if (!manUnits || manUnits <= 0) { setApprovalError("금액을 입력해주세요."); return; }
    const amount = manUnits * UNIT;
    setApproving(true);
    try {
      const res = await fetch("/api/limit-approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, amount }),
      });
      const data = await res.json();
      if (!res.ok) { setApprovalError(data.error || "승인에 실패했습니다."); return; }
      alert(data.message);
      setApprovingId(null);
      setApprovalAmount("");
      await fetchAll();
    } catch {
      setApprovalError("서버 오류가 발생했습니다.");
    } finally {
      setApproving(false);
    }
  };

  const openApprovalForm = (id: string) => {
    setApprovingId(id);
    setApprovalAmount("");
    setApprovalError("");
  };

  const myOpenRequest = mine.find((r) => r.status === "OPEN");
  const pendingOthers = others.filter((r) => !r.myApproval);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-500">불러오는 중...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between gap-3 mb-1">
          <h1 className="text-2xl font-bold text-gray-900">허가 요청</h1>
          {!showForm && !myOpenRequest && (
            <button
              onClick={() => setShowForm(true)}
              className="shrink-0 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              + 허가 요청
            </button>
          )}
        </div>
        <p className="text-sm text-gray-600">
          개인 한도 초과 시 전체에 요청, 여러 명이 나눠서 승인할 수 있습니다
        </p>
      </div>

      {/* 내 잔여 한도 */}
      {personalInfo && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm flex items-center justify-between">
          <span className="text-sm text-gray-600">내 개인 잔여 한도</span>
          <span className={`text-lg font-bold ${personalInfo.remainingPersonal <= 0 ? "text-red-600" : "text-green-600"}`}>
            {formatAmount(personalInfo.remainingPersonal)}
          </span>
        </div>
      )}

      {/* 요청 생성 폼 */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-800 mb-1">허가 요청 보내기</h2>
          <p className="text-xs text-gray-600 mb-4">전체 참여자에게 공개되며, 여러 명이 나눠서 승인할 수 있습니다</p>
          <form onSubmit={handleSubmitRequest} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                요청 금액 <span className="text-red-500">*</span>
                <span className="text-gray-500 font-normal ml-1">(1만원 단위)</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  placeholder="예: 10"
                  className="w-40 px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-600">만원</span>
                {formAmount && (
                  <span className="text-sm text-blue-600 font-medium">
                    = {formatAmount(parseInt(formAmount || "0") * UNIT)}
                  </span>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                요청 사유 <span className="text-gray-500 font-normal">(선택)</span>
              </label>
              <input
                type="text"
                value={formReason}
                onChange={(e) => setFormReason(e.target.value)}
                placeholder="예: 팀 회식 추가 비용"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">
                {formError}
              </div>
            )}
            <div className="flex gap-3">
              <button type="submit" disabled={submitting}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium rounded-lg text-sm transition-colors">
                {submitting ? "요청 중..." : "전체에 요청 보내기"}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setFormError(""); }}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg text-sm transition-colors">
                취소
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 탭 */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100">
          <button onClick={() => setTab("board")}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${tab === "board" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700"}`}>
            전체 요청 현황
            {pendingOthers.length > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                {pendingOthers.length}
              </span>
            )}
          </button>
          <button onClick={() => setTab("mine")}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${tab === "mine" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700"}`}>
            내 요청 내역 ({mine.length})
          </button>
        </div>

        {/* 전체 요청 현황 (게시판) */}
        {tab === "board" && (
          <div className="divide-y divide-gray-100">
            {others.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-400 text-sm">
                현재 모집 중인 허가 요청이 없습니다.
              </div>
            ) : (
              others.map((req) => {
                const remaining = req.requestedAmount - req.approvedTotal;
                const isApproving = approvingId === req.id;
                const approvalAmountNum = parseInt(approvalAmount || "0") * UNIT;
                // 최대 승인 가능: 내 잔여한도 vs 요청 잔여분 중 작은 값
                const maxByPersonal = personalInfo ? Math.floor(personalInfo.remainingPersonal / UNIT) : 0;
                const maxByRemaining = Math.floor(remaining / UNIT);
                const maxApprove = Math.min(maxByPersonal, maxByRemaining);

                return (
                  <div key={req.id} className="px-6 py-5">
                    {/* 헤더 */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-900">
                            {req.requester?.nickname}
                          </span>
                          <span className="text-gray-600 text-sm">님의 요청</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_INFO[req.status].cls}`}>
                            {STATUS_INFO[req.status].label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <span className="font-bold text-blue-700 text-base">
                            {formatMan(req.requestedAmount)}
                          </span>
                          {req.reason && (
                            <span className="text-gray-600">— {req.reason}</span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-gray-500">{formatDate(req.createdAt)}</span>
                    </div>

                    {/* 진행 바 */}
                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>승인 현황</span>
                        <span>
                          <span className="font-semibold text-green-600">{formatMan(req.approvedTotal)}</span>
                          {" / "}{formatMan(req.requestedAmount)}
                          {remaining > 0 && <span className="text-orange-500 ml-1">({formatMan(remaining)} 부족)</span>}
                        </span>
                      </div>
                      <ProgressBar current={req.approvedTotal} total={req.requestedAmount} />
                    </div>

                    {/* 승인자 목록 */}
                    {req.approvals.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {req.approvals.map((a) => (
                          <span key={a.id}
                            className={`text-xs px-2.5 py-1 rounded-full ${a.approverId === req.myApproval?.approverId ? "bg-blue-100 text-blue-700 font-medium" : "bg-gray-100 text-gray-600"}`}>
                            {a.approver.nickname} {formatMan(a.amount)}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* 내 승인 현황 & 입력 */}
                    {req.myApproval ? (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-green-600 font-medium">✓ 내가 {formatMan(req.myApproval.amount)} 승인함</span>
                        <button onClick={() => openApprovalForm(req.id)}
                          className="text-xs text-blue-500 hover:underline">수정</button>
                      </div>
                    ) : (
                      <button onClick={() => openApprovalForm(req.id)}
                        className="text-sm px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors">
                        승인하기
                      </button>
                    )}

                    {/* 승인 입력 폼 */}
                    {isApproving && (
                      <div className="mt-3 p-4 bg-gray-50 rounded-xl space-y-3">
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                          <span>
                            내 잔여 한도:{" "}
                            <span className="font-medium text-green-600">
                              {formatMan(personalInfo?.remainingPersonal ?? 0)}
                            </span>
                          </span>
                          <span>
                            요청 잔여분:{" "}
                            <span className="font-medium text-orange-500">
                              {formatMan(remaining)}
                            </span>
                          </span>
                          <span className="text-gray-600">
                            → 최대 <span className="font-semibold text-gray-700">{maxApprove}만원</span> 승인 가능
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            max={maxApprove}
                            step="1"
                            value={approvalAmount}
                            onChange={(e) => { setApprovalAmount(e.target.value); setApprovalError(""); }}
                            placeholder="예: 4"
                            className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                          <span className="text-sm text-gray-600">만원</span>
                          {approvalAmount && (
                            <span className="text-sm text-green-600 font-medium">
                              = {formatAmount(approvalAmountNum)}
                            </span>
                          )}
                        </div>
                        {approvalError && (
                          <p className="text-xs text-red-500">{approvalError}</p>
                        )}
                        <div className="flex gap-2">
                          <button onClick={() => handleApprove(req.id)} disabled={approving}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white text-sm font-medium rounded-lg transition-colors">
                            {approving ? "처리 중..." : "승인 확정"}
                          </button>
                          <button onClick={() => { setApprovingId(null); setApprovalAmount(""); setApprovalError(""); }}
                            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm rounded-lg transition-colors">
                            취소
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* 내 요청 내역 */}
        {tab === "mine" && (
          <div className="divide-y divide-gray-100">
            {mine.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-400 text-sm">
                보낸 요청이 없습니다.
              </div>
            ) : (
              mine.map((req) => {
                const remaining = req.requestedAmount - req.approvedTotal;
                return (
                  <div key={req.id} className="px-6 py-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 text-base">{formatMan(req.requestedAmount)}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_INFO[req.status].cls}`}>
                          {STATUS_INFO[req.status].label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {req.status === "OPEN" && (
                          <button onClick={() => handleCancel(req.id)}
                            className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors">
                            취소
                          </button>
                        )}
                        {req.status === "FULFILLED" && (
                          <button onClick={() => handleReturn(req.id)}
                            className="text-xs px-3 py-1.5 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 rounded-lg transition-colors font-medium">
                            반환
                          </button>
                        )}
                      </div>
                    </div>

                    {req.reason && <p className="text-sm text-gray-600 mb-2">사유: {req.reason}</p>}

                    {/* 진행 바 */}
                    <div className="mb-2">
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>승인 현황</span>
                        <span>
                          {formatMan(req.approvedTotal)} / {formatMan(req.requestedAmount)}
                          {req.status === "OPEN" && remaining > 0 && (
                            <span className="text-orange-500 ml-1">({formatMan(remaining)} 부족)</span>
                          )}
                        </span>
                      </div>
                      <ProgressBar current={req.approvedTotal} total={req.requestedAmount} />
                    </div>

                    {/* 승인자 목록 */}
                    {req.approvals.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {req.approvals.map((a) => (
                          <span key={a.id} className="text-xs bg-green-50 text-green-700 px-2.5 py-1 rounded-full">
                            {a.approver.nickname} {formatMan(a.amount)}
                            {req.status === "RETURNED" && a.returnedAmount > 0 && (
                              <span className="text-gray-500 ml-1">(반환 {formatMan(a.returnedAmount)})</span>
                            )}
                          </span>
                        ))}
                      </div>
                    )}

                    {req.status === "RETURNED" && (
                      <p className="text-xs text-gray-600 mt-2">
                        실사용 {formatMan(req.usedAmount)} / 반환 {formatMan(req.requestedAmount - req.usedAmount)}
                      </p>
                    )}

                    <p className="text-xs text-gray-500 mt-2">{formatDate(req.createdAt)}</p>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function LimitRequestsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64 text-gray-500">불러오는 중...</div>}>
      <LimitRequestsContent />
    </Suspense>
  );
}
