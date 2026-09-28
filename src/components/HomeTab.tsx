import React, { useMemo, useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  ArrowUpRight, 
  ArrowDownLeft, 
  ArrowLeftRight, 
  CreditCard, 
  Scale,
  Wallet,
  Building2,
  ChevronLeft,
  ChevronDown,
  History,
  Edit3,
  Trash2,
  Users,
  Coins,
  Check,
  Clock,
  Cloud
} from 'lucide-react';
import type { Account, JournalEntry, JournalItem } from '../db/types';
import { formatMoney, toPersianDigits } from '../utils/dateUtils';

interface HomeTabProps {
  accounts: Account[];
  recentEntries: (JournalEntry & { items: JournalItem[] })[];
  onOpenNewTransaction: () => void;
  onGoToAccounts: () => void;
  onGoToLedger: () => void;
  onViewAccountLedger: (accountId: string) => void;
  onEditAccount: (account: Account) => void;
  onEditTransaction: (entry: JournalEntry & { items: JournalItem[] }) => void;
  onDeleteTransaction: (entryId: string) => void;
  onFinalizeTransaction?: (entryId: string) => void;
  searchHighlight?: string;
}

export const HomeTab: React.FC<HomeTabProps> = ({
  accounts,
  recentEntries,
  onOpenNewTransaction,
  onGoToAccounts,
  onViewAccountLedger,
  onEditAccount,
  onEditTransaction,
  onDeleteTransaction,
  onFinalizeTransaction,
  searchHighlight,
}) => {
  // همه منوهای کشویی به صورت پیش‌فرض کاملاً بسته هستند
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    banks: false,
    cash: false,
    persons: false,
  });

  const toggleGroup = (groupKey: string) => {
    setOpenGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  };

  const q = searchHighlight?.trim().toLowerCase() || '';

  const isSystemAccount = (a: Account) => (
    a.id === 'acc_inventory_default' ||
    a.id === 'acc_purchase_cost_default' ||
    a.id === 'acc_notes_receivable_default' ||
    a.id === 'acc_notes_payable_default' ||
    a.id === 'acc_sales_revenue_default' ||
    a.name.includes('موجودی کالا') ||
    a.name.includes('موجودی انبار') ||
    a.name.includes('اسناد دریافتنی') ||
    a.name.includes('اسناد پرداختنی') ||
    a.name.includes('انبار') ||
    a.name.includes('خرید کالا')
  );

  const totalAssets = accounts
    .filter((a) => a.type === 'asset' && !isSystemAccount(a))
    .reduce((sum, a) => sum + a.balance, 0);

  let totalIncome = 0;
  let totalExpense = 0;

  for (const entry of recentEntries) {
    if (entry.status !== 'draft') {
      if (entry.source_type === 'expense') {
        const amt = entry.items?.reduce((max, i) => Math.max(max, i.debit), 0) || 0;
        totalExpense += amt;
      } else if (entry.source_type === 'income') {
        const amt = entry.items?.reduce((max, i) => Math.max(max, i.debit), 0) || 0;
        totalIncome += amt;
      }
    }
  }

  const netBalance = totalIncome - totalExpense;
  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  const bankAccounts = useMemo(
    () => accounts.filter((a) => a.type === 'asset' && !isSystemAccount(a) && (!a.name.includes('صندوق') && !a.name.includes('کیف') && !a.name.includes('تنخواه'))),
    [accounts]
  );

  const cashAccounts = useMemo(
    () => accounts.filter((a) => a.type === 'asset' && !isSystemAccount(a) && (a.name.includes('صندوق') || a.name.includes('کیف') || a.name.includes('تنخواه'))),
    [accounts]
  );

  const personAccounts = useMemo(
    () => accounts.filter((a) => a.type === 'person' || a.type === 'liability'),
    [accounts]
  );

  const draftEntries = useMemo(() => {
    return recentEntries.filter((e) => e.status === 'draft');
  }, [recentEntries]);

  const isGroupExpanded = (key: string, list: Account[]) => {
    if (openGroups[key]) return true;
    if (q && list.some((a) => a.name.toLowerCase().includes(q) || a.code.toLowerCase().includes(q) || (a.card_number && a.card_number.includes(q)))) {
      return true;
    }
    return false;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ردیف شاخص‌های مالی کلیدی با کادربندی تفکیک‌شده */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 block mb-1">موجودی نقد و بانک‌ها</span>
            <div className="text-xl font-extrabold text-slate-900 font-mono">
              {formatMoney(totalAssets)}{' '}
              <span className="text-xs font-normal text-slate-400">ریال</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center shrink-0">
            <Wallet className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 block mb-1">درآمدهای ثبت‌شده</span>
            <div className="text-xl font-extrabold text-emerald-600 font-mono">
              {formatMoney(totalIncome)}{' '}
              <span className="text-xs font-normal text-slate-400">ریال</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 block mb-1">هزینه‌های ثبت‌شده</span>
            <div className="text-xl font-extrabold text-rose-600 font-mono">
              {formatMoney(totalExpense)}{' '}
              <span className="text-xs font-normal text-slate-400">ریال</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-500 border border-rose-100 flex items-center justify-center shrink-0">
            <TrendingDown className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 block mb-1">تراز خالص عملکرد</span>
            <div className={`text-xl font-extrabold font-mono ${netBalance >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
              {formatMoney(netBalance)}{' '}
              <span className="text-xs font-normal text-slate-400">ریال</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shrink-0">
            <Scale className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* تراکنش‌های پیش‌نویس (در صورت وجود) */}
      {draftEntries.length > 0 && (
        <div className="bg-amber-50/90 rounded-2xl border border-amber-300 shadow-xs p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-amber-900">تراکنش‌های در انتظار ثبت (همگام‌سازی شده از کیف پول)</h3>
                <span className="text-xs text-amber-700">این اسناد پیش‌نویس هستند و پس از تأیید در مانده حساب‌ها اعمال می‌شوند.</span>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-amber-200 text-amber-900 text-xs font-bold font-mono">
              {toPersianDigits(draftEntries.length)} سند در انتظار
            </span>
          </div>

          <div className="bg-white rounded-xl border border-amber-200 overflow-hidden">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-amber-100/70 text-amber-900 text-[11px] font-bold border-b border-amber-200">
                  <th className="py-2.5 px-3 text-center border-l border-amber-200">تاریخ</th>
                  <th className="py-2.5 px-3 text-center border-l border-amber-200">از حساب</th>
                  <th className="py-2.5 px-3 text-center border-l border-amber-200">به حساب</th>
                  <th className="py-2.5 px-3 text-right border-l border-amber-200">شرح</th>
                  <th className="py-2.5 px-3 text-center border-l border-amber-200">مبلغ (ریال)</th>
                  <th className="py-2.5 px-3 text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100">
                {draftEntries.map((entry) => {
                  const totalAmount = entry.items?.reduce((max, i) => Math.max(max, i.debit), 0) || 0;
                  const fromAcc = entry.from_account_id ? accountMap.get(entry.from_account_id) : null;
                  const toAcc = entry.to_account_id ? accountMap.get(entry.to_account_id) : null;

                  return (
                    <tr key={entry.id} className="hover:bg-amber-50/50 transition-colors">
                      <td className="py-2.5 px-3 text-center font-mono text-slate-600 border-l border-amber-100">
                        {toPersianDigits(entry.entry_date_shamsi)}
                      </td>
                      <td className="py-2.5 px-3 text-center font-medium text-slate-800 border-l border-amber-100">
                        {fromAcc ? fromAcc.name : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-center font-medium text-slate-800 border-l border-amber-100">
                        {toAcc ? toAcc.name : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-700 font-medium border-l border-amber-100">
                        <div className="flex items-center gap-1.5">
                          <Cloud className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                          <span>{entry.description || 'تراکنش کیف پول'}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900 border-l border-amber-100">
                        {formatMoney(totalAmount)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {onFinalizeTransaction && (
                            <button
                              onClick={() => onFinalizeTransaction(entry.id)}
                              className="flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition-all cursor-pointer shadow-2xs"
                            >
                              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                              <span>تأیید</span>
                            </button>
                          )}
                          <button
                            onClick={() => onEditTransaction(entry)}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteTransaction(entry.id)}
                            className="p-1.5 rounded-lg border border-rose-200 text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer"
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
        </div>
      )}

      {/* بخش اصلی: گروه‌های کشویی کادربندی‌شده + پنل دسترسی سریع */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* ستون گروه‌های حساب‌ها */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between pb-1">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-sky-600" />
              <h3 className="text-sm font-extrabold text-slate-900">سرفصل‌ها و حساب‌ها</h3>
            </div>
            <button
              onClick={onGoToAccounts}
              className="text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center gap-0.5 cursor-pointer"
            >
              <span>مشاهده و ویرایش کدینگ</span>
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {/* 1. گروه بانک‌ها و کارت‌ها */}
          {(() => {
            const open = isGroupExpanded('banks', bankAccounts);
            const total = bankAccounts.reduce((sum, a) => sum + a.balance, 0);
            return (
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden transition-all">
                <button
                  type="button"
                  onClick={() => toggleGroup('banks')}
                  className={`w-full p-4 flex items-center justify-between bg-white hover:bg-slate-50 cursor-pointer transition-colors text-right ${
                    open ? 'border-b border-slate-200' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center shrink-0">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">بانک‌ها و کارت‌ها</span>
                        <span className="text-[11px] font-bold font-mono bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full border border-sky-200">
                          {toPersianDigits(bankAccounts.length)}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">حساب‌های بانکی تعریف‌شده</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-left">
                      <span className="text-[11px] text-slate-400 block">جمع موجودی:</span>
                      <span className="text-sm font-extrabold text-slate-900 font-mono">
                        {formatMoney(total)} <span className="text-[10px] font-normal text-slate-400">ریال</span>
                      </span>
                    </div>
                    <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 border border-slate-200">
                      {open ? <ChevronDown className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                    </div>
                  </div>
                </button>

                {open && (
                  <div className="p-3 bg-slate-50/60 divide-y divide-slate-200/80">
                    {bankAccounts.length === 0 ? (
                      <p className="text-center text-xs text-slate-400 py-3">حساب بانکی ثبت نشده است.</p>
                    ) : (
                      bankAccounts.map((acc) => (
                        <div
                          key={acc.id}
                          className="p-3 bg-white border border-slate-200/90 rounded-xl mb-2.5 last:mb-0 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs hover:border-sky-300"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-700 border border-sky-100 flex items-center justify-center shrink-0">
                              <CreditCard className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-900">{acc.name}</span>
                                {acc.card_number && (
                                  <span className="text-[10px] font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                    {toPersianDigits(acc.card_number)}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono">کد: #{toPersianDigits(acc.code)}</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                            <div className="text-left font-mono font-extrabold text-slate-900 text-xs sm:text-sm">
                              {formatMoney(acc.balance)} <span className="text-[10px] font-normal text-slate-400 font-sans">ریال</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                onClick={() => onViewAccountLedger(acc.id)}
                                className="px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-bold transition-colors cursor-pointer shadow-2xs border border-sky-100 flex items-center gap-1"
                              >
                                <History className="w-3.5 h-3.5" />
                                <span>گردش</span>
                              </button>
                              <button
                                onClick={() => onEditAccount(acc)}
                                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* 2. گروه صندوق‌ها و تنخواه */}
          {(() => {
            const open = isGroupExpanded('cash', cashAccounts);
            const total = cashAccounts.reduce((sum, a) => sum + a.balance, 0);
            return (
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden transition-all">
                <button
                  type="button"
                  onClick={() => toggleGroup('cash')}
                  className={`w-full p-4 flex items-center justify-between bg-white hover:bg-slate-50 cursor-pointer transition-colors text-right ${
                    open ? 'border-b border-slate-200' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0">
                      <Coins className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">صندوق‌ها و تنخواه</span>
                        <span className="text-[11px] font-bold font-mono bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
                          {toPersianDigits(cashAccounts.length)}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">موجودی نقد فیزیکی و صندوق‌ها</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-left">
                      <span className="text-[11px] text-slate-400 block">جمع موجودی:</span>
                      <span className="text-sm font-extrabold text-slate-900 font-mono">
                        {formatMoney(total)} <span className="text-[10px] font-normal text-slate-400">ریال</span>
                      </span>
                    </div>
                    <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 border border-slate-200">
                      {open ? <ChevronDown className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                    </div>
                  </div>
                </button>

                {open && (
                  <div className="p-3 bg-slate-50/60 divide-y divide-slate-200/80">
                    {cashAccounts.length === 0 ? (
                      <p className="text-center text-xs text-slate-400 py-3">صندوقی ثبت نشده است.</p>
                    ) : (
                      cashAccounts.map((acc) => (
                        <div
                          key={acc.id}
                          className="p-3 bg-white border border-slate-200/90 rounded-xl mb-2.5 last:mb-0 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs hover:border-amber-300"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 border border-amber-100 flex items-center justify-center shrink-0">
                              <Wallet className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="text-xs font-bold text-slate-900 block">{acc.name}</span>
                              <span className="text-[10px] text-slate-400 font-mono">کد: #{toPersianDigits(acc.code)}</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                            <div className="text-left font-mono font-extrabold text-slate-900 text-xs sm:text-sm">
                              {formatMoney(acc.balance)} <span className="text-[10px] font-normal text-slate-400 font-sans">ریال</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                onClick={() => onViewAccountLedger(acc.id)}
                                className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold transition-colors cursor-pointer shadow-2xs border border-amber-100 flex items-center gap-1"
                              >
                                <History className="w-3.5 h-3.5" />
                                <span>گردش</span>
                              </button>
                              <button
                                onClick={() => onEditAccount(acc)}
                                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* 3. گروه طرف‌حساب‌ها و اشخاص */}
          {(() => {
            const open = isGroupExpanded('persons', personAccounts);
            const total = personAccounts.reduce((sum, a) => sum + a.balance, 0);
            return (
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden transition-all">
                <button
                  type="button"
                  onClick={() => toggleGroup('persons')}
                  className={`w-full p-4 flex items-center justify-between bg-white hover:bg-slate-50 cursor-pointer transition-colors text-right ${
                    open ? 'border-b border-slate-200' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center shrink-0">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">اشخاص و طرف‌حساب‌ها</span>
                        <span className="text-[11px] font-bold font-mono bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full border border-purple-200">
                          {toPersianDigits(personAccounts.length)}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">بدهکاران، بستانکاران و مشتریان</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-left">
                      <span className="text-[11px] text-slate-400 block">تراز کل اشخاص:</span>
                      <span className="text-sm font-extrabold text-slate-900 font-mono">
                        {formatMoney(total)} <span className="text-[10px] font-normal text-slate-400">ریال</span>
                      </span>
                    </div>
                    <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 border border-slate-200">
                      {open ? <ChevronDown className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                    </div>
                  </div>
                </button>

                {open && (
                  <div className="p-3 bg-slate-50/60 divide-y divide-slate-200/80">
                    {personAccounts.length === 0 ? (
                      <p className="text-center text-xs text-slate-400 py-3">طرف‌حسابی ثبت نشده است.</p>
                    ) : (
                      personAccounts.map((acc) => (
                        <div
                          key={acc.id}
                          className="p-3 bg-white border border-slate-200/90 rounded-xl mb-2.5 last:mb-0 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs hover:border-purple-300"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 border border-purple-100 flex items-center justify-center shrink-0">
                              <Users className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="text-xs font-bold text-slate-900 block">{acc.name}</span>
                              <span className="text-[10px] text-slate-400 font-mono">کد: #{toPersianDigits(acc.code)}</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                            <div className="text-left font-mono font-extrabold text-slate-900 text-xs sm:text-sm">
                              {formatMoney(Math.abs(acc.balance))}{' '}
                              <span className="text-[10px] font-normal text-slate-500 font-sans">
                                {acc.balance >= 0 ? 'ریال (طلبکار)' : 'ریال (بدهکار)'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                onClick={() => onViewAccountLedger(acc.id)}
                                className="px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold transition-colors cursor-pointer shadow-2xs border border-purple-100 flex items-center gap-1"
                              >
                                <History className="w-3.5 h-3.5" />
                                <span>گردش</span>
                              </button>
                              <button
                                onClick={() => onEditAccount(acc)}
                                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* پنل دسترسی سریع به عملیات حسابداری با کادربندی‌های مشخص */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 mb-1">دسترسی سریع عملیاتی</h3>
            <p className="text-xs text-slate-500 mb-4">ثبت رویدادهای مالی بر پایه سند دوبل</p>

            <div className="space-y-3">
              <button
                onClick={onOpenNewTransaction}
                className="w-full flex items-center justify-between p-3.5 rounded-xl bg-rose-50/70 hover:bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold transition-all text-right cursor-pointer shadow-2xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-rose-500 text-white flex items-center justify-center shadow-xs">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block font-bold">ثبت هزینه و پرداخت</span>
                    <span className="text-[10px] text-rose-500 font-normal">بستانکار شدن بانک/صندوق</span>
                  </div>
                </div>
              </button>

              <button
                onClick={onOpenNewTransaction}
                className="w-full flex items-center justify-between p-3.5 rounded-xl bg-emerald-50/70 hover:bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold transition-all text-right cursor-pointer shadow-2xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                    <ArrowDownLeft className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block font-bold">ثبت دریافت و درآمد</span>
                    <span className="text-[10px] text-emerald-600 font-normal">بدهکار شدن بانک/صندوق</span>
                  </div>
                </div>
              </button>

              <button
                onClick={onOpenNewTransaction}
                className="w-full flex items-center justify-between p-3.5 rounded-xl bg-sky-50/70 hover:bg-sky-50 border border-sky-200 text-sky-700 text-xs font-bold transition-all text-right cursor-pointer shadow-2xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-xs">
                    <ArrowLeftRight className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block font-bold">انتقال وجه بین حساب‌ها</span>
                    <span className="text-[10px] text-sky-600 font-normal">کارت به کارت / انتقال داخلی</span>
                  </div>
                </div>
              </button>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 text-[11px] text-slate-500 flex items-center justify-between">
            <span>نوع سیستم حسابداری:</span>
            <span className="font-bold text-sky-600 font-mono">Double-Entry Ledger</span>
          </div>
        </div>
      </div>
    </div>
  );
};