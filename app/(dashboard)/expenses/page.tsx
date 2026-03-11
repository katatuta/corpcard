"use client";

import { useEffect, useState, useCallback } from "react";

interface Expense {
  id: string;
  amount: number;
  usedAt: string;
  merchant: string | null;
  memo: string | null;
}

interface ExpenseData {
  expenses: Expense[];
  totalUsed: number;
  effectiveLimit: number;
  monthlyLimit: number;
  remainingPersonal: number;
}

function formatAmount(amount: number) {
  return amount.toLocaleString("ko-KR") + "원";
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function getMonthKey(dateStr: string) {
  return dateStr.slice(0, 7); // "2025-03"
}

function getMonthLabel(key: string) {
  const [year, month] = key.split("-");
  return `${year}년 ${parseInt(month)}월`;
}

function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

const emptyForm = { amount: "", usedAt: "", merchant: "", memo: "" };

export default function ExpensesPage() {
  const [data, setData] = useState<ExpenseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editingLimit, setEditingLimit] = useState(false);
  const [limitInput, setLimitInput] = useState("");
  const [limitSaving, setLimitSaving] = useState(false);
  const [limitError, setLimitError] = useState("");

  const fetchExpenses = useCallback(async () => {
    try {
      const res = await fetch("/api/expenses");
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === "amount") {
      const numeric = value.replace(/[^0-9]/g, "");
      setForm((f) => ({ ...f, amount: numeric }));
    } else {
      setForm((f) => ({ ...f, [name]: value }));
    }
    setFormError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    const amount = parseInt(form.amount.replace(/,/g, ""), 10);
    if (!amount || amount <= 0) {
      setFormError("올바른 금액을 입력해주세요.");
      return;
    }
    setSubmitting(true);
    try {
      const url = editingId ? `/api/expenses/${editingId}` : "/api/expenses";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          usedAt: form.usedAt || undefined,
          merchant: form.merchant || undefined,
          memo: form.memo || undefined,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        setFormError(result.error || "저장에 실패했습니다.");
        return;
      }
      setForm(emptyForm);
      setShowForm(false);
      setEditingId(null);
      await fetchExpenses();
    } catch {
      setFormError("서버 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (expense: Expense) => {
    setForm({
      amount: String(expense.amount),
      usedAt: expense.usedAt ? expense.usedAt.slice(0, 10) : "",
      merchant: expense.merchant || "",
      memo: expense.memo || "",
    });
    setEditingId(expense.id);
    setShowForm(true);
    setFormError("");
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
      if (res.ok) {
        setDeleteConfirmId(null);
        await fetchExpenses();
      }
    } catch {}
  };

  const handleCancel = () => {
    setForm(emptyForm);
    setShowForm(false);
    setEditingId(null);
    setFormError("");
  };

  const handleLimitEdit = () => {
    setLimitInput(String(data?.monthlyLimit ?? ""));
    setLimitError("");
    setEditingLimit(true);
  };

  const handleLimitSave = async () => {
    const value = parseInt(limitInput.replace(/,/g, ""), 10);
    if (!value || value <= 0) {
      setLimitError("올바른 금액을 입력해주세요.");
      return;
    }
    setLimitSaving(true);
    try {
      const res = await fetch("/api/user/limit", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthlyLimit: value }),
      });
      if (!res.ok) {
        const d = await res.json();
        setLimitError(d.error || "저장에 실패했습니다.");
        return;
      }
      setEditingLimit(false);
      await fetchExpenses();
    } catch {
      setLimitError("서버 오류가 발생했습니다.");
    } finally {
      setLimitSaving(false);
    }
  };

  const amountNum = parseInt(form.amount || "0", 10);
  const remainingPersonal = data?.remainingPersonal ?? 0;
  const isOverPersonal = amountNum > 0 && amountNum > remainingPersonal + (editingId
    ? (data?.expenses.find(e => e.id === editingId)?.amount ?? 0) : 0);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-500">불러오는 중...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">내 사용 내역</h1>
          <p className="text-sm text-gray-600 mt-1">본인의 카드 사용 내역을 관리하세요</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            + 내역 추가
          </button>
        )}
      </div>

      {/* 개인 한도 요약 */}
      {data && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="flex items-center justify-center gap-1 mb-1">
                <p className="text-xs text-gray-600">이번 달 한도</p>
                {!editingLimit && (
                  <button
                    onClick={handleLimitEdit}
                    className="text-gray-400 hover:text-blue-500 transition-colors"
                    title="한도 설정"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                  </button>
                )}
              </div>
              {editingLimit ? (
                <div className="space-y-1.5">
                  <input
                    type="text"
                    value={limitInput ? parseInt(limitInput).toLocaleString("ko-KR") : ""}
                    onChange={(e) => {
                      setLimitInput(e.target.value.replace(/[^0-9]/g, ""));
                      setLimitError("");
                    }}
                    placeholder="금액 입력"
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-center text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    style={{ WebkitTextFillColor: '#111827' }}
                  />
                  {limitError && <p className="text-xs text-red-500">{limitError}</p>}
                  <div className="flex gap-1">
                    <button
                      onClick={handleLimitSave}
                      disabled={limitSaving}
                      className="flex-1 py-1 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded transition-colors"
                    >
                      {limitSaving ? "저장 중" : "저장"}
                    </button>
                    <button
                      onClick={() => setEditingLimit(false)}
                      className="flex-1 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
                    >
                      취소
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-lg font-bold text-gray-900">{formatAmount(data.effectiveLimit)}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-600 mb-1">이번 달 사용액</p>
              <p className="text-lg font-bold text-blue-600">{formatAmount(data.totalUsed)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 mb-1">이번 달 잔여</p>
              <p className={`text-lg font-bold ${data.remainingPersonal <= 0 ? "text-red-600" : "text-green-600"}`}>
                {formatAmount(data.remainingPersonal)}
              </p>
            </div>
          </div>
          {data.remainingPersonal <= 0 && (
            <p className="text-center text-sm text-orange-600 mt-3 font-medium">
              이번 달 한도를 모두 사용했습니다.
            </p>
          )}
        </div>
      )}

      {/* 입력 폼 */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-800 mb-4">
            {editingId ? "내역 수정" : "새 내역 추가"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 금액 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                금액 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="amount"
                value={form.amount ? parseInt(form.amount).toLocaleString("ko-KR") : ""}
                onChange={handleFormChange}
                placeholder="0"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {amountNum > 0 && (
                <p className={`text-xs mt-1 ${isOverPersonal ? "text-red-500" : "text-gray-600"}`}>
                  {isOverPersonal
                    ? `⚠️ 이번 달 잔여 한도(${formatAmount(remainingPersonal)})를 초과합니다.`
                    : `입력 후 잔여: ${formatAmount(remainingPersonal - amountNum)}`}
                </p>
              )}
            </div>

            {/* 사용 일자 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                사용 일자 <span className="text-gray-500 font-normal">(미입력 시 오늘 날짜 자동 저장)</span>
              </label>
              <input
                type="date"
                name="usedAt"
                value={form.usedAt}
                onChange={handleFormChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* 사용처 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                사용처/상호명 <span className="text-gray-500 font-normal">(선택)</span>
              </label>
              <input
                type="text"
                name="merchant"
                value={form.merchant}
                onChange={handleFormChange}
                placeholder="예: 스타벅스"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* 메모 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                메모 <span className="text-gray-500 font-normal">(선택)</span>
              </label>
              <input
                type="text"
                name="memo"
                value={form.memo}
                onChange={handleFormChange}
                placeholder="메모 입력"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">
                {formError}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="submit"
                disabled={submitting || isOverPersonal}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium rounded-lg text-sm transition-colors"
              >
                {submitting ? "저장 중..." : editingId ? "수정 완료" : "저장"}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg text-sm transition-colors"
              >
                취소
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 내역 목록 (월별 그룹) */}
      {!data?.expenses.length ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-12 text-center text-gray-600 text-sm">
          아직 등록된 사용 내역이 없습니다.
        </div>
      ) : (() => {
        const currentKey = getCurrentMonthKey();
        const grouped = data.expenses.reduce((acc, e) => {
          const key = getMonthKey(e.usedAt);
          if (!acc[key]) acc[key] = [];
          acc[key].push(e);
          return acc;
        }, {} as Record<string, Expense[]>);
        const monthKeys = Object.keys(grouped).sort().reverse();

        return (
          <div className="space-y-4">
            {monthKeys.map((key) => {
              const monthExpenses = grouped[key];
              const monthTotal = monthExpenses.reduce((s, e) => s + e.amount, 0);
              const isCurrent = key === currentKey;

              return (
                <div key={key} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  {/* 월 헤더 */}
                  <div className="px-6 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-700">{getMonthLabel(key)}</span>
                      {isCurrent && (
                        <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium">이번 달</span>
                      )}
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{formatAmount(monthTotal)}</span>
                  </div>

                  {/* 해당 월 내역 */}
                  <div className="divide-y divide-gray-100">
                    {monthExpenses.map((expense) => (
                      <div key={expense.id} className="px-6 py-4 flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3">
                            <span className="font-semibold text-gray-900">{formatAmount(expense.amount)}</span>
                            {expense.merchant && (
                              <span className="text-sm text-gray-600 truncate">{expense.merchant}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-gray-600">{formatDate(expense.usedAt)}</span>
                            {expense.memo && (
                              <span className="text-xs text-gray-600 truncate">{expense.memo}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4 shrink-0">
                          <button
                            onClick={() => handleEdit(expense)}
                            className="text-xs px-3 py-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                          >
                            수정
                          </button>
                          {deleteConfirmId === expense.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDelete(expense.id)}
                                className="text-xs px-3 py-1.5 text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
                              >
                                확인
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="text-xs px-3 py-1.5 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                              >
                                취소
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirmId(expense.id)}
                              className="text-xs px-3 py-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                            >
                              삭제
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}
