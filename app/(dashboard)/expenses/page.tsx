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
  remainingPersonal: number;
}

function formatAmount(amount: number) {
  return amount.toLocaleString("ko-KR") + "원";
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
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
              <p className="text-xs text-gray-600 mb-1">개인 실질 한도</p>
              <p className="text-lg font-bold text-gray-900">{formatAmount(data.effectiveLimit)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 mb-1">내 사용액</p>
              <p className="text-lg font-bold text-blue-600">{formatAmount(data.totalUsed)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 mb-1">개인 잔여</p>
              <p className={`text-lg font-bold ${data.remainingPersonal <= 0 ? "text-red-600" : "text-green-600"}`}>
                {formatAmount(data.remainingPersonal)}
              </p>
            </div>
          </div>
          {data.remainingPersonal <= 0 && (
            <p className="text-center text-sm text-orange-600 mt-3 font-medium">
              개인 한도를 초과했습니다. 허가 요청 탭에서 한도 허가를 요청하세요.
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
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {amountNum > 0 && (
                <p className={`text-xs mt-1 ${isOverPersonal ? "text-red-500" : "text-gray-600"}`}>
                  {isOverPersonal
                    ? `⚠️ 개인 잔여 한도(${formatAmount(remainingPersonal)})를 초과합니다. 허가 요청이 필요합니다.`
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
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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

      {/* 내역 목록 */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-700">사용 내역</h2>
          <span className="text-sm text-gray-600">총 {data?.expenses.length ?? 0}건</span>
        </div>

        {!data?.expenses.length ? (
          <div className="px-6 py-12 text-center text-gray-600 text-sm">
            아직 등록된 사용 내역이 없습니다.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {data.expenses.map((expense) => (
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
        )}

        {data && data.expenses.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-100 flex justify-between items-center bg-gray-50">
            <span className="text-sm text-gray-600">합계</span>
            <span className="text-base font-bold text-gray-900">{formatAmount(data.totalUsed)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
