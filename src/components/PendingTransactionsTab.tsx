import React, { useState, useMemo } from 'react';
import { 
  Clock, 
  Check, 
  CheckCheck, 
  Edit3, 
  Trash2, 
  RefreshCw, 
  Cloud, 
  Search, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import type { Account, JournalEntry, JournalItem } from '../db/types';
import { formatMoney, toPersianDigits, formatShamsiWithSlash } from '../utils/dateUtils';
import { syncWalletTransactions } from '../services/walletSync';

interface PendingTransactionsTabProps {
  entries: (JournalEntry & { items: JournalItem[] })[];
  accounts: Account[];
  onRefresh: () => Promise<void>;
  onEditTransaction: (entry: JournalEntry & { items: JournalItem[] }) => void;
  onFinalizeTransaction: (entryId: string) => Promise<void>;
  onDeleteTransaction: (entryId: string) => Promise<void>;
}

export const PendingTransactionsTab: React.FC<PendingTransactionsTabProps> = ({
  entries,
  accounts,
  onRefresh,
  onEditTransaction,
  onFinalizeTransaction,
  onDeleteTransaction,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isFinalizingAll, setIsFinalizingAll] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  const draftEntries = useMemo(() => {
    return entries.filter((e) => e.status === 'draft');
  }, [entries]);

  const filteredDrafts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return draftEntries;
    return draftEntries.filter((e) => {
      const fromAcc = e.from_account_id ? accountMap.get(e.from_account_id) : null;
      const toAcc = e.to_account_id ? accountMap.get(e.to_account_id) : null;
      const totalAmount = e.items?.reduce((max, i) => Math.max(max, i.debit), 0) || 0;
      return (
        e.description?.toLowerCase().includes(q) ||
        (fromAcc && fromAcc.name.toLowerCase().includes(q)) ||
        (toAcc && toAcc.name.toLowerCase().includes(q)) ||
        totalAmount.toString().includes(q) ||
        e.entry_date_shamsi?.includes(q)
      );
    });
  }, [draftEntries, searchTerm, accountMap]);

  const handleSync = async () => {
    try {
      setIsSyncing(true);
      setFeedback(null);
      const res = await syncWalletTransactions();
      if (res.success) {
        await onRefresh();
        setFeedback({ message: res.message || 'همگام‌سازی با موفقیت انجام شد.', type: 'success' });
      } else {
        setFeedback({ message: res.message || 'خطا در همگام‌سازی.', type: 'error' });
      }
    } catch (e: any) {
      setFeedback({ message: e?.message || 'خطا در اتصال به کیف پول.', type: 'error' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFinalizeAll = async () => {
    if (draftEntries.length === 0) return;
    if (!window.confirm(`آیا از ثبت نهایی کلیه ${toPersianDigits(draftEntries.length)} تراکنش در انتظار اطمینان دارید؟`)) {
      return;
    }

    try {
      setIsFinalizingAll(true);
      setFeedback(null);
      for (const draft of draftEntries) {
        await onFinalizeTransaction(draft.id);
      }
      await onRefresh();
      setFeedback({
        message: `${toPersianDigits(draftEntries.length)} تراکنش با موفقیت ثبت نهایی شد و در مانده حساب‌ها اعمال گردید.`,
        type: 'success',
      });
    } catch (e: any) {
      setFeedback({ message: e?.message || 'خطا در ثبت نهایی تراکنش‌ها.', type: 'error' });
    } finally {
      setIsFinalizingAll(false);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* سربرگ بخش لیست انتظار */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-slate-900">لیست انتظار تراکنش‌ها</h2>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 font-mono text-xs font-extrabold">
                {toPersianDigits(draftEntries.length)} تراکنش
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              تراکنش‌های دریافت‌شده از کیف پول و پیش‌نویس‌های نیازمند بازبینی و تأیید نهایی
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {draftEntries.length > 0 && (
            <button
              onClick={handleFinalizeAll}
              disabled={isFinalizingAll}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-4 py-2 text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
              title="ثبت نهایی یک‌جای کلیه تراکنش‌های در انتظار"
            >
              <CheckCheck className="w-4 h-4" />
              <span>{isFinalizingAll ? 'در حال ثبت...' : 'تأیید نهایی همه'}</span>
            </button>
          )}

          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-xl px-3.5 py-2 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="فراخوانی آخرین تراکنش‌ها از سرور کیف پول"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-sky-600 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'در حال دریافت...' : 'همگام‌سازی با کیف پول'}</span>
          </button>
        </div>
      </div>

      {/* پیام اعلان وضعیت */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center gap-2 border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* کادر راهنمای کاربری */}
      <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 leading-relaxed flex items-start gap-3">
        <div className="w-6 h-6 rounded-lg bg-amber-200/80 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
          💡
        </div>
        <p>
          تراکنش‌های موجود در این لیست در حالت <strong>«پیش‌نویس و در انتظار»</strong> ذخیره شده‌اند و 
          <strong> هنوز در مانده حساب‌های بانکی و دفاتر رسمی اعمال نشده‌اند</strong>. شما می‌توانید حساب‌های مبدأ و مقصد یا 
          شرح تراکنش را بازبینی نموده و با زدن دکمه <strong>«تأیید»</strong>، تراکنش را قطعی نمایید تا اثر مالی آن در دفاتر ثبت گردد.
        </p>
      </div>

      {/* ابزار جستجو */}
      {draftEntries.length > 0 && (
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between gap-4">
          <div className="relative w-full max-w-sm">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="جستجو در شرح، حساب، مبلغ یا تاریخ..."
              className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-amber-500 focus:bg-white transition-all shadow-2xs"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
          </div>
          <span className="text-xs text-slate-500 font-mono">
            نمایش {toPersianDigits(filteredDrafts.length)} از {toPersianDigits(draftEntries.length)} مورد
          </span>
        </div>
      )}

      {/* جدول تراکنش‌های در انتظار */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {filteredDrafts.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-sm font-extrabold text-slate-800">
              {draftEntries.length === 0 ? 'هیچ تراکنشی در لیست انتظار وجود ندارد' : 'موردی با این عبارت یافت نشد'}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {draftEntries.length === 0
                ? 'تمامی تراکنش‌های دریافتی از کیف پول بازبینی و تأیید نهایی شده‌اند. با کلیک بر روی دکمه همگام‌سازی می‌توانید تراکنش‌های جدید را دریافت نمایید.'
                : 'لطفاً عبارت جستجو را تغییر دهید.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-amber-100/70 text-amber-900 text-[11px] font-bold border-b border-amber-200">
                  <th className="py-3 px-3 text-center border-l border-amber-200 w-12">ردیف</th>
                  <th className="py-3 px-3 text-center border-l border-amber-200 w-28">تاریخ شمسی</th>
                  <th className="py-3 px-3 text-center border-l border-amber-200">حساب مبدأ (از حساب)</th>
                  <th className="py-3 px-3 text-center border-l border-amber-200">حساب مقصد (به حساب)</th>
                  <th className="py-3 px-4 text-right border-l border-amber-200">شرح تراکنش</th>
                  <th className="py-3 px-3 text-center border-l border-amber-200 w-28">کارمزد (ریال)</th>
                  <th className="py-3 px-3 text-center border-l border-amber-200 w-36">مبلغ (ریال)</th>
                  <th className="py-3 px-3 text-center w-36">عملیات بازبینی</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDrafts.map((entry, idx) => {
                  const totalAmount = entry.items?.reduce((max, i) => Math.max(max, i.debit), 0) || 0;
                  const fromAcc = entry.from_account_id ? accountMap.get(entry.from_account_id) : null;
                  const toAcc = entry.to_account_id ? accountMap.get(entry.to_account_id) : null;

                  return (
                    <tr key={entry.id} className="hover:bg-amber-50/40 transition-colors">
                      <td className="py-3 px-3 text-center font-mono text-slate-500 border-l border-slate-100">
                        {toPersianDigits(idx + 1)}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-800 border-l border-slate-100">
                        {formatShamsiWithSlash(entry.entry_date_shamsi)}
                      </td>
                      <td className="py-3 px-3 text-center font-medium text-slate-800 border-l border-slate-100">
                        {fromAcc ? (
                          <span className="inline-block px-2 py-0.5 rounded-lg bg-slate-100 text-slate-800 text-xs">
                            {fromAcc.name}
                          </span>
                        ) : (
                          <span className="text-rose-500 font-bold">تعیین‌نشده</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center font-medium text-slate-800 border-l border-slate-100">
                        {toAcc ? (
                          <span className="inline-block px-2 py-0.5 rounded-lg bg-slate-100 text-slate-800 text-xs">
                            {toAcc.name}
                          </span>
                        ) : (
                          <span className="text-rose-500 font-bold">تعیین‌نشده</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-700 border-l border-slate-100">
                        <div className="flex items-center gap-1.5">
                          <Cloud className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                          <span>{entry.description || 'تراکنش دریافتی از کیف پول'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-slate-600 border-l border-slate-100">
                        {entry.fee ? formatMoney(entry.fee) : '۰'}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-extrabold text-amber-900 border-l border-slate-100 text-sm">
                        {formatMoney(totalAmount)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={async () => {
                              await onFinalizeTransaction(entry.id);
                              await onRefresh();
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all shadow-xs cursor-pointer active:scale-95"
                            title="تأیید و ثبت نهایی در دفاتر رسمی"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>تأیید</span>
                          </button>
                          <button
                            onClick={() => onEditTransaction(entry)}
                            className="p-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer"
                            title="ویرایش حساب‌ها یا شرح قبل از تأیید"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={async () => {
                              if (window.confirm('آیا از حذف این تراکنش از لیست انتظار اطمینان دارید؟')) {
                                await onDeleteTransaction(entry.id);
                                await onRefresh();
                              }
                            }}
                            className="p-1.5 rounded-xl border border-rose-200 text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors cursor-pointer"
                            title="حذف پیش‌نویس"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
