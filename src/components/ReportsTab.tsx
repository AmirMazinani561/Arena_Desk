import React, { useState, useMemo } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Scale, Filter, RotateCcw } from 'lucide-react';
import type { JournalEntry, JournalItem } from '../db/types';
import { formatMoney, toPersianDigits, getCurrentShamsi } from '../utils/dateUtils';
import { ShamsiDatePicker } from './ShamsiDatePicker';

interface ReportsTabProps {
  entries: (JournalEntry & { items: JournalItem[] })[];
}

export const ReportsTab: React.FC<ReportsTabProps> = ({ entries }) => {
  const today = getCurrentShamsi();
  const currentYearStr = `${today.jy}/01/01`;
  const currentMonthStr = `${today.jy}/${String(today.jm).padStart(2, '0')}/01`;

  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  const setRangeAll = () => {
    setFromDate('');
    setToDate('');
  };

  const setRangeThisYear = () => {
    setFromDate(currentYearStr);
    setToDate(`${today.jy}/12/29`);
  };

  const setRangeThisMonth = () => {
    setFromDate(currentMonthStr);
    setToDate(`${today.jy}/${String(today.jm).padStart(2, '0')}/31`);
  };

  // فیلتر اسناد بر اساس بازه تاریخ شمسی
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const d = entry.entry_date_shamsi;
      if (!d) return true;
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
      return true;
    });
  }, [entries, fromDate, toDate]);

  // تفکیک مجموع هزینه‌ها، درآمدها و اقلام بر اساس نوع و حساب
  const { totalExpense, totalIncome, expenseByAccount, incomeByAccount } = useMemo(() => {
    let exp = 0;
    let inc = 0;
    const expMap = new Map<string, number>();
    const incMap = new Map<string, number>();

    for (const entry of filteredEntries) {
      if (entry.source_type === 'expense') {
        const amount = entry.items?.reduce((max, i) => Math.max(max, i.debit), 0) || 0;
        exp += amount;

        // طرف سرفصل هزینه
        for (const it of entry.items || []) {
          if (it.debit > 0 && it.account_name) {
            expMap.set(it.account_name, (expMap.get(it.account_name) || 0) + it.debit);
          }
        }
      } else if (entry.source_type === 'income') {
        const amount = entry.items?.reduce((max, i) => Math.max(max, i.debit), 0) || 0;
        inc += amount;

        // طرف سرفصل درآمد
        for (const it of entry.items || []) {
          if (it.credit > 0 && it.account_name) {
            incMap.set(it.account_name, (incMap.get(it.account_name) || 0) + it.credit);
          }
        }
      }
    }

    return {
      totalExpense: exp,
      totalIncome: inc,
      expenseByAccount: Array.from(expMap.entries()).sort((a, b) => b[1] - a[1]),
      incomeByAccount: Array.from(incMap.entries()).sort((a, b) => b[1] - a[1]),
    };
  }, [filteredEntries]);

  const netBalance = totalIncome - totalExpense;

  return (
    <div className="space-y-5 pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-sky-600" />
            <span>گزارش‌های تحلیلی و تراز مالی</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            بررسی سود و زیان، عملکرد مالی و تفکیک سرفصل‌ها با امکان فیلتر بازه تاریخی
          </p>
        </div>

        {/* دکمه‌های سریع بازه زمانی */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={setRangeAll}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              !fromDate && !toDate
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            تمام دوره
          </button>
          <button
            onClick={setRangeThisYear}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              fromDate === currentYearStr
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            امسال ({toPersianDigits(today.jy)})
          </button>
          <button
            onClick={setRangeThisMonth}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              fromDate === currentMonthStr
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            ماه جاری
          </button>
        </div>
      </div>

      {/* نوار انتخاب بازه تاریخ اختصاصی */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
          <Filter className="w-4 h-4 text-sky-600" />
          <span>بازه تاریخ گزارش:</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">از تاریخ:</span>
          <div className="w-36">
            <ShamsiDatePicker
              value={fromDate}
              onChange={setFromDate}
              compact
              showTodayButton={false}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">تا تاریخ:</span>
          <div className="w-36">
            <ShamsiDatePicker
              value={toDate}
              onChange={setToDate}
              compact
              showTodayButton={false}
            />
          </div>
        </div>

        {(fromDate || toDate) && (
          <button
            onClick={setRangeAll}
            className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2.5 py-1.5 rounded-xl font-bold cursor-pointer transition-colors"
            title="حذف فیلتر تاریخ"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>حذف فیلتر</span>
          </button>
        )}

        <div className="text-xs text-slate-400 mr-auto font-mono">
          تعداد اسناد انتخابی: <strong className="text-slate-700">{toPersianDigits(filteredEntries.length)}</strong>
        </div>
      </div>

      {/* کارتهای آماری */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs border-r-4 border-r-emerald-500">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-emerald-700 font-bold">کل درآمدهای دوره</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-extrabold text-slate-900 font-mono">
            {formatMoney(totalIncome)} <span className="text-xs font-normal text-slate-400">ریال</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs border-r-4 border-r-rose-500">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-rose-700 font-bold">کل هزینه‌های دوره</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-extrabold text-slate-900 font-mono">
            {formatMoney(totalExpense)} <span className="text-xs font-normal text-slate-400">ریال</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs border-r-4 border-r-sky-500">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-sky-700 font-bold">تراز خالص عملکرد (سود / زیان)</span>
            <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div
            className={`text-xl font-extrabold font-mono ${
              netBalance >= 0 ? 'text-emerald-700' : 'text-rose-600'
            }`}
          >
            {formatMoney(netBalance)} <span className="text-xs font-normal text-slate-400">ریال</span>
          </div>
        </div>
      </div>

      {/* تفکیک هزینه‌ها و درآمدها بر اساس سرفصل */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* هزینه‌ها بر اساس سرفصل */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-rose-500" />
            <span>تفکیک هزینه‌ها به تفکیک سرفصل</span>
          </h3>
          {expenseByAccount.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">هزینه‌ای در این بازه ثبت نشده است.</p>
          ) : (
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {expenseByAccount.map(([accName, amt]) => {
                const pct = totalExpense > 0 ? ((amt / totalExpense) * 100).toFixed(1) : '0';
                return (
                  <div key={accName} className="p-3 bg-slate-50/70 rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700">{accName}</span>
                      <span className="font-mono font-extrabold text-slate-900">{formatMoney(amt)} ریال</span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-rose-500 h-full rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="text-[10px] text-slate-400 text-left font-mono">
                      {toPersianDigits(pct)}٪ از کل هزینه‌ها
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* درآمدها بر اساس سرفصل */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            <span>تفکیک درآمدها به تفکیک سرفصل</span>
          </h3>
          {incomeByAccount.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">درآمدی در این بازه ثبت نشده است.</p>
          ) : (
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {incomeByAccount.map(([accName, amt]) => {
                const pct = totalIncome > 0 ? ((amt / totalIncome) * 100).toFixed(1) : '0';
                return (
                  <div key={accName} className="p-3 bg-slate-50/70 rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700">{accName}</span>
                      <span className="font-mono font-extrabold text-slate-900">{formatMoney(amt)} ریال</span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="text-[10px] text-slate-400 text-left font-mono">
                      {toPersianDigits(pct)}٪ از کل درآمدها
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
