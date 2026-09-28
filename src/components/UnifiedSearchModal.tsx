import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, X, CreditCard, BookOpen } from 'lucide-react';
import type { Account, JournalEntry, JournalItem } from '../db/types';
import { formatMoney, toPersianDigits } from '../utils/dateUtils';

interface UnifiedSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  entries: (JournalEntry & { items: JournalItem[] })[];
  onSelectAccount: (accountId: string) => void;
}

export const UnifiedSearchModal: React.FC<UnifiedSearchModalProps> = ({
  isOpen,
  onClose,
  accounts,
  entries,
  onSelectAccount,
}) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 80);
      setQuery('');
    }
  }, [isOpen]);

  const q = query.trim().toLowerCase();

  const matchingAccounts = useMemo(() => {
    if (!q) return [];
    return accounts.filter((a) => {
      return (
        a.name.toLowerCase().includes(q) ||
        a.code.includes(q) ||
        (a.card_number && a.card_number.includes(q)) ||
        (a.account_number && a.account_number.includes(q))
      );
    });
  }, [accounts, q]);

  const matchingEntries = useMemo(() => {
    if (!q) return [];
    return entries.filter((e) => {
      const matchDesc = e.description.toLowerCase().includes(q);
      const matchNum = String(e.entry_number).includes(q);
      const matchDate = e.entry_date_shamsi.includes(q);
      const matchItems = e.items?.some((i) => i.account_name?.toLowerCase().includes(q) || (i.note && i.note.toLowerCase().includes(q)));
      return matchDesc || matchNum || matchDate || matchItems;
    });
  }, [entries, q]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-sky-100 flex flex-col max-h-[80vh] overflow-hidden">
        {/* نوار جستجوی بالا */}
        <div className="p-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/80">
          <Search className="w-5 h-5 text-sky-600 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="جستجوی سراسری در حساب‌ها، اشخاص، سرفصل‌ها، شماره کارت و اسناد دوبل..."
            className="w-full bg-transparent text-sm text-slate-800 placeholder-slate-400 focus:outline-none font-medium"
          />
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200/60"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* محتوای نتایج */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {!q ? (
            <div className="p-10 text-center text-slate-400 text-xs">
              عبارت مورد نظر خود (نام شخص، حساب بانکی، هزینه، تاریخ یا شماره سند) را تایپ کنید.
            </div>
          ) : matchingAccounts.length === 0 && matchingEntries.length === 0 ? (
            <div className="p-10 text-center text-slate-400 text-xs">
              هیچ نتیجه‌ای یافت نشد.
            </div>
          ) : (
            <>
              {/* بخش حساب‌ها و اشخاص */}
              {matchingAccounts.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-sky-600" />
                    <span>حساب‌ها، اشخاص و سرفصل‌ها ({matchingAccounts.length})</span>
                  </h4>
                  <div className="space-y-1.5">
                    {matchingAccounts.map((acc) => (
                      <button
                        key={acc.id}
                        onClick={() => {
                          onSelectAccount(acc.id);
                          onClose();
                        }}
                        className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-sky-200 hover:bg-sky-50/50 transition-all text-right"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-xs font-bold text-slate-800">{acc.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">کد: {toPersianDigits(acc.code)}</span>
                          {acc.account_number && (
                            <span className="text-[10px] text-slate-500 font-mono">
                              حساب: {toPersianDigits(acc.account_number)}
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-bold text-slate-700">
                          {formatMoney(acc.balance)} ریال
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* بخش اسناد حسابداری */}
              {matchingEntries.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-sky-600" />
                    <span>اسناد دوبل حسابداری ({matchingEntries.length})</span>
                  </h4>
                  <div className="space-y-1.5">
                    {matchingEntries.map((e) => {
                      const totalAmount = e.items?.reduce((max, i) => Math.max(max, i.debit), 0) || 0;
                      return (
                        <div
                          key={e.id}
                          className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-100/70 transition-colors"
                        >
                          <div>
                            <div className="text-xs font-bold text-slate-800">
                              سند #{toPersianDigits(e.entry_number)} • {e.description}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              تاریخ: {toPersianDigits(e.entry_date_shamsi)}
                            </div>
                          </div>
                          <span className="text-xs font-bold text-sky-700">
                            {formatMoney(totalAmount)} ریال
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
