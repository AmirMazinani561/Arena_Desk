import React, { useState, useEffect } from 'react';
import { X, BookOpen, CheckCircle, Send } from 'lucide-react';
import type { Checkbook, Cheque } from '../db/types';
import { getCheckbookLeaves } from '../db/sqlite';
import { toPersianDigits, separateThousands } from '../utils/dateUtils';

interface CheckbookLeavesModalProps {
  isOpen: boolean;
  onClose: () => void;
  checkbook: Checkbook | null;
  onIssueLeaf: (leafNumber: number) => void;
}

export const CheckbookLeavesModal: React.FC<CheckbookLeavesModalProps> = ({
  isOpen,
  onClose,
  checkbook,
  onIssueLeaf,
}) => {
  const [leaves, setLeaves] = useState<{
    leaf_number: number;
    is_used: boolean;
    cheque?: Cheque;
  }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !checkbook) return;
    setLoading(true);
    getCheckbookLeaves(checkbook.id)
      .then((data) => setLeaves(data))
      .finally(() => setLoading(false));
  }, [isOpen, checkbook]);

  if (!isOpen || !checkbook) return null;

  const usedCount = leaves.filter((l) => l.is_used).length;
  const remainingCount = leaves.length - usedCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs animate-fade-in" dir="rtl">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[88vh]">
        
        {/* هدر */}
        <div className="bg-gradient-to-r from-sky-700 to-sky-800 text-white px-6 py-4 flex items-center justify-between border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
              <BookOpen className="text-sky-200" size={20} />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base">
                برگه‌های دسته‌چک {checkbook.bank_name}
              </h3>
              <p className="text-[11px] text-white/70">سریال: {toPersianDigits(checkbook.serial)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white p-1.5 hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* نوار خلاصه */}
        <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-slate-500">بازه شماره‌ها: </span>
              <strong className="text-slate-800 font-mono">از {toPersianDigits(String(checkbook.from_number))} تا {toPersianDigits(String(checkbook.to_number))}</strong>
            </div>
            <div>
              <span className="text-slate-500">کل برگه‌ها: </span>
              <strong className="text-slate-800 font-mono">{toPersianDigits(String(checkbook.leaf_count))} برگه</strong>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
              {toPersianDigits(String(remainingCount))} برگه سفید
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 border border-slate-300 font-bold">
              {toPersianDigits(String(usedCount))} صادرشده
            </span>
          </div>
        </div>

        {/* لیست برگه‌ها */}
        <div className="p-4 overflow-y-auto flex-1 space-y-2">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400 font-medium">
              در حال بارگذاری وضعیت برگه‌ها...
            </div>
          ) : (
            leaves.map((leaf) => {
              const isUsed = leaf.is_used;
              const chk = leaf.cheque;

              return (
                <div
                  key={leaf.leaf_number}
                  className={`p-3 rounded-2xl border flex items-center justify-between gap-3 transition-colors ${
                    isUsed
                      ? 'bg-slate-50/80 border-slate-200'
                      : 'bg-white border-slate-200 hover:border-sky-300 shadow-2xs'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-mono font-bold text-xs ${
                      isUsed ? 'bg-slate-200 text-slate-700' : 'bg-sky-50 text-sky-700 border border-sky-200'
                    }`}>
                      {toPersianDigits(leaf.leaf_number)}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900">
                          برگه شماره {toPersianDigits(String(leaf.leaf_number))}
                        </span>
                        {isUsed ? (
                          <span className="px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-slate-100 text-slate-800 flex items-center gap-1 border border-slate-200">
                            <CheckCircle size={11} className="text-sky-600" />
                            {chk?.status === 'cleared' ? 'پاس‌شده' : 'صادرشده'}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            سفید و آماده صدور
                          </span>
                        )}
                      </div>

                      {chk && (
                        <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap items-center gap-3">
                          <span>مبلغ: <strong className="text-slate-800 font-mono font-bold">{separateThousands(String(chk.amount))} ریال</strong></span>
                          <span>سررسید: <strong className="font-mono text-slate-800">{toPersianDigits(chk.due_date_shamsi)}</strong></span>
                          {chk.person_name && <span>در وجه: <strong className="text-slate-800">{chk.person_name}</strong></span>}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    {!isUsed ? (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onIssueLeaf(leaf.leaf_number);
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
                      >
                        <Send size={12} />
                        <span>صدور این چک</span>
                      </button>
                    ) : (
                      <span className="text-[10.5px] font-medium text-slate-400 font-mono">
                        {chk?.sayad_id ? `صیاد: ${toPersianDigits(chk.sayad_id)}` : ''}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* دکمه خروج */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            بستن
          </button>
        </div>

      </div>
    </div>
  );
};