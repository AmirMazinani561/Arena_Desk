import React, { useState, useEffect, useMemo } from 'react';
import { ListFilter, ArrowRight, Edit3, Trash2, Check, Filter, RotateCcw, Lock, Printer, Search } from 'lucide-react';
import type { JournalEntry, JournalItem, Account } from '../db/types';
import { formatMoney, toPersianDigits, calculateRunningBalances, getDiagnosis, getCurrentShamsi } from '../utils/dateUtils';
import { getAccountLedger, getAccountDetailedLedger, deleteTransaction } from '../db/sqlite';
import { ShamsiDatePicker } from './ShamsiDatePicker';

interface LedgerViewProps {
  entries: (JournalEntry & { items: JournalItem[] })[];
  selectedAccountId?: string | null;
  accounts: Account[];
  onClearAccountFilter?: () => void;
  onEditTransaction: (entry: JournalEntry & { items: JournalItem[] }) => void;
  onRefresh: () => void;
  onFinalizeTransaction?: (entryId: string) => void;
}

export const LedgerView: React.FC<LedgerViewProps> = ({
  entries,
  selectedAccountId,
  accounts,
  onClearAccountFilter,
  onEditTransaction,
  onRefresh,
  onFinalizeTransaction,
}) => {
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [viewMode, setViewMode] = useState<'detailed' | 'standard'>('detailed');

  const [accountLedgerData, setAccountLedgerData] = useState<{
    account: Account | null;
    items: (JournalItem & { entry: JournalEntry; running_balance?: number })[];
    totalDebit: number;
    totalCredit: number;
  } | null>(null);

  const [detailedLedgerData, setDetailedLedgerData] = useState<any | null>(null);
  const [ledgerFilterTab, setLedgerFilterTab] = useState<'final' | 'draft' | 'all'>('final');

  const draftCount = useMemo(() => entries.filter(e => e.status === 'draft').length, [entries]);
  const finalCount = useMemo(() => entries.filter(e => e.status !== 'draft').length, [entries]);

  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  const runningBalances = useMemo(() => {
    return calculateRunningBalances(accounts, entries);
  }, [entries, accounts]);

  const q = searchTerm.trim().toLowerCase();

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (ledgerFilterTab === 'final' && e.status === 'draft') return false;
      if (ledgerFilterTab === 'draft' && e.status !== 'draft') return false;

      const d = e.entry_date_shamsi;
      if (!d) return true;
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;

      if (q) {
        const fromAcc = e.from_account_id ? accountMap.get(e.from_account_id) : null;
        const toAcc = e.to_account_id ? accountMap.get(e.to_account_id) : null;
        const totalAmount = e.items?.reduce((max, i) => Math.max(max, i.debit), 0) || 0;

        const match =
          e.description?.toLowerCase().includes(q) ||
          e.entry_number.toString().includes(q) ||
          (fromAcc && fromAcc.name.toLowerCase().includes(q)) ||
          (toAcc && toAcc.name.toLowerCase().includes(q)) ||
          totalAmount.toString().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [entries, fromDate, toDate, q, accountMap]);

  const loadData = () => {
    if (selectedAccountId) {
      getAccountLedger(selectedAccountId).then(setAccountLedgerData);
      getAccountDetailedLedger(selectedAccountId).then(setDetailedLedgerData);
    } else {
      setAccountLedgerData(null);
      setDetailedLedgerData(null);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedAccountId]);

  const handleDelete = async (entryId: string) => {
    if (window.confirm('آیا از حذف این تراکنش اطمینان دارید؟ تمام مانده‌های حساب‌ها به صورت خودکار اصلاح خواهند شد.')) {
      try {
        await deleteTransaction(entryId);
        onRefresh();
        loadData();
      } catch (err: any) {
        alert(err.message || 'خطا در حذف تراکنش');
      }
    }
  };

  const filteredPersonItems = useMemo(() => {
    if (viewMode === 'detailed') {
      const list = detailedLedgerData?.items || [];
      return list.filter((r: any) => {
        const d = r.date_shamsi;
        if (!d) return true;
        if (fromDate && d < fromDate) return false;
        if (toDate && d > toDate) return false;

        if (q) {
          const match =
            r.description?.toLowerCase().includes(q) ||
            r.debit?.toString().includes(q) ||
            r.credit?.toString().includes(q);
          if (!match) return false;
        }

        return true;
      });
    } else {
      const list = accountLedgerData?.items || [];
      return list.filter((it: any) => {
        const d = it.entry?.entry_date_shamsi;
        if (!d) return true;
        if (fromDate && d < fromDate) return false;
        if (toDate && d > toDate) return false;

        if (q) {
          const match =
            it.note?.toLowerCase().includes(q) ||
            it.entry?.description?.toLowerCase().includes(q) ||
            it.debit?.toString().includes(q) ||
            it.credit?.toString().includes(q);
          if (!match) return false;
        }

        return true;
      });
    }
  }, [viewMode, detailedLedgerData, accountLedgerData, fromDate, toDate, q]);

  const { currentDebitTotal, currentCreditTotal } = useMemo(() => {
    let deb = 0;
    let crd = 0;
    filteredPersonItems.forEach((r: any) => {
      deb += Number(r.debit) || 0;
      crd += Number(r.credit) || 0;
    });
    return { currentDebitTotal: deb, currentCreditTotal: crd };
  }, [filteredPersonItems]);

  if (selectedAccountId && (accountLedgerData || detailedLedgerData)) {
    const account = detailedLedgerData?.account || accountLedgerData?.account;
    const initBal = account?.initial_balance ? Number(account.initial_balance) : 0;
    const finalBalance = (account?.type === 'asset' || account?.type === 'person')
      ? (initBal + currentDebitTotal - currentCreditTotal)
      : (initBal + currentCreditTotal - currentDebitTotal);
    const diag = getDiagnosis(finalBalance);

    return (
      <div className="space-y-4">
        <style dangerouslySetInnerHTML={{
          __html: `
          @media print {
            @page {
              size: A4 portrait;
              margin: 10mm 10mm 10mm 10mm !important;
            }
            html, body {
              background: #fff !important;
              color: #000 !important;
              font-size: 9.5px !important;
              margin: 0 !important;
              padding: 0 !important;
              width: 100% !important;
              box-sizing: border-box !important;
              direction: rtl !important;
            }
            *, *:before, *:after {
              box-sizing: border-box !important;
            }
            body * {
              visibility: hidden;
            }
            #printable-statement, #printable-statement * {
              visibility: visible;
            }
            #printable-statement {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              right: 0 !important;
              width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            .no-print {
              display: none !important;
            }
            table {
              width: 100% !important;
              table-layout: fixed !important;
              border-collapse: collapse !important;
              page-break-inside: auto;
            }
            tr {
              page-break-inside: avoid;
              page-break-after: auto;
            }
            thead {
              display: table-header-group;
            }
            th, td {
              border: 1px solid #334155 !important;
              padding: 4px 2px !important;
              font-size: 8.5px !important;
              overflow: hidden !important;
              word-break: break-word !important;
              text-align: center !important;
            }
            th {
              background-color: #f1f5f9 !important;
              color: #0f172a !important;
            }
            .print-header-box {
              border: 1px solid #334155 !important;
              padding: 8px 12px !important;
              margin-bottom: 6px !important;
              border-radius: 4px !important;
              width: 100% !important;
            }
          }
        `}} />

        <div id="printable-statement" className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-300 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4 print-header-box">
            <div className="flex items-center gap-3">
              {onClearAccountFilter && (
                <button
                  onClick={onClearAccountFilter}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer no-print"
                  title="بازگشت به همه تراکنش‌ها"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
              <div className="text-center md:text-right">
                <div className="flex items-center justify-center md:justify-start gap-2">
                  <h2 className="text-base font-bold text-slate-900 print:text-sm">
                    صورت‌حساب و گردش حساب: {account?.name}
                  </h2>
                  <span className="text-[11px] font-mono bg-sky-50 text-sky-800 border border-sky-300 px-2 py-0.5 rounded-md font-bold print:text-[10px]">
                    کد: {toPersianDigits(account?.code || '')}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center justify-center md:justify-start gap-4 print:text-[9px] print:text-slate-800">
                  <span>تاریخ گزارش: {toPersianDigits(getCurrentShamsi().formatted)}</span>
                  <span>
                    بازه تاریخی: {fromDate ? toPersianDigits(fromDate) : 'ابتدا'} تا {toDate ? toPersianDigits(toDate) : 'اکنون'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-4 text-xs font-bold print:text-[9.5px]">
              <div className="text-center px-1">
                <span className="text-[10px] text-slate-500 block font-normal print:text-[8px]">گردش بدهکار:</span>
                <span className="text-sky-700 font-mono mt-0.5 block">{formatMoney(currentDebitTotal)} ریال</span>
              </div>

              <div className="h-8 w-px bg-slate-300"></div>

              <div className="text-center px-1">
                <span className="text-[10px] text-slate-500 block font-normal print:text-[8px]">گردش بستانکار:</span>
                <span className="text-rose-600 font-mono mt-0.5 block">{formatMoney(currentCreditTotal)} ریال</span>
              </div>

              <div className="h-8 w-px bg-slate-300"></div>

              <div className="text-center px-1">
                <span className="text-[10px] text-slate-500 block font-normal print:text-[8px]">مانده نهایی در بازه:</span>
                <div className="flex items-center justify-center gap-1.5 mt-0.5">
                  <span className="text-slate-900 font-extrabold font-mono">{formatMoney(Math.abs(finalBalance))} ریال</span>
                  <span className={`${diag.textClass} px-1.5 py-0.2 rounded font-bold`}>{diag.label}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 no-print">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <Filter className="w-4 h-4 text-sky-600" />
                <span>فیلتر تاریخ صورت‌حساب:</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">از:</span>
                <div className="w-34">
                  <ShamsiDatePicker value={fromDate} onChange={setFromDate} compact showTodayButton={false} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">تا:</span>
                <div className="w-34">
                  <ShamsiDatePicker value={toDate} onChange={setToDate} compact showTodayButton={false} />
                </div>
              </div>
              {(fromDate || toDate) && (
                <button
                  onClick={() => { setFromDate(''); setToDate(''); }}
                  className="flex items-center gap-1 text-xs text-rose-600 hover:bg-rose-50 px-2.5 py-1.5 rounded-xl font-bold cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>حذف فیلتر</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-48">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="جستجو در گردش..."
                  className="w-full pl-3 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-sky-500"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>

              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  onClick={() => setViewMode('detailed')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${viewMode === 'detailed' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  ریز اقلام
                </button>
                <button
                  onClick={() => setViewMode('standard')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${viewMode === 'standard' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  سرجمع اسناد
                </button>
              </div>

              <button
                onClick={() => {
                  const originalTitle = document.title;
                  const partyName = account?.name || 'صورت‌حساب';
                  document.title = partyName;
                  window.print();
                  setTimeout(() => {
                    document.title = originalTitle;
                  }, 1000);
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-xl transition-all cursor-pointer shadow-2xs"
                title="چاپ اختصاصی صورت‌حساب"
              >
                <Printer className="w-4 h-4 text-sky-600" />
                <span>چاپ A4</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-300 shadow-xs overflow-hidden print:border-none">
            {viewMode === 'detailed' ? (
              <div className="overflow-x-auto print:overflow-visible">
                <table className="w-full text-xs border-collapse border border-slate-300 table-fixed">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 text-[10.5px] font-bold">
                      <th className="border border-slate-300 py-2 px-1 text-center align-middle" style={{ width: '4%' }}>ردیف</th>
                      <th className="border border-slate-300 py-2 px-1 text-center align-middle" style={{ width: '9%' }}>تاریخ</th>
                      <th className="border border-slate-300 py-2 px-2 text-center align-middle" style={{ width: '28%' }}>شرح عملیات</th>
                      <th className="border border-slate-300 py-2 px-1 text-center align-middle" style={{ width: '6%' }}>مقدار</th>
                      <th className="border border-slate-300 py-2 px-1 text-center align-middle" style={{ width: '6%' }}>واحد</th>
                      <th className="border border-slate-300 py-2 px-1 text-center align-middle" style={{ width: '10%' }}>قیمت (ریال)</th>
                      <th className="border border-slate-300 py-2 px-1 text-center align-middle text-sky-800" style={{ width: '11%' }}>بدهکار (ریال)</th>
                      <th className="border border-slate-300 py-2 px-1 text-center align-middle text-rose-800" style={{ width: '11%' }}>بستانکار (ریال)</th>
                      {/* جابجایی ستون مانده سمت راست و تشخیص سمت چپ */}
                      <th className="border border-slate-300 py-2 px-1 text-center align-middle font-bold" style={{ width: '9%' }}>مانده (ریال)</th>
                      <th className="border border-slate-300 py-2 px-1 text-center align-middle whitespace-nowrap" style={{ width: '6%' }}>تشخیص</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPersonItems.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="border border-slate-300 p-8 text-center text-slate-400">
                          هیچ تراکنشی یافت نشد.
                        </td>
                      </tr>
                    ) : (
                      filteredPersonItems.map((row: any, idx: number) => {
                        const rowDiag = getDiagnosis(row.running_balance || 0);
                        const isRowMatch = Boolean(q && (row.description?.toLowerCase().includes(q) || row.debit?.toString().includes(q) || row.credit?.toString().includes(q)));
                        return (
                          <tr key={row.id} className={`transition-colors ${isRowMatch ? 'bg-amber-100/80 font-semibold ring-1 ring-amber-400' : 'hover:bg-slate-50'}`}>
                            <td className="border border-slate-300 py-2 px-1 text-center align-middle text-slate-700 font-mono text-xs font-bold">
                              {toPersianDigits(idx + 1)}
                            </td>
                            <td className="border border-slate-300 py-2 px-1 text-center align-middle font-mono text-slate-800 text-xs font-bold">
                              {toPersianDigits(row.date_shamsi)}
                            </td>
                            <td className="border border-slate-300 py-2 px-2 text-center align-middle text-slate-900 font-medium truncate">
                              {row.description}
                            </td>
                            <td className="border border-slate-300 py-2 px-1 text-center align-middle font-mono font-bold text-slate-800 text-xs">
                              {row.quantity !== undefined ? toPersianDigits(row.quantity) : '-'}
                            </td>
                            <td className="border border-slate-300 py-2 px-1 text-center align-middle text-slate-600">
                              {row.unit || '-'}
                            </td>
                            <td className="border border-slate-300 py-2 px-1 text-center align-middle font-mono text-slate-800">
                              {row.unit_price ? formatMoney(row.unit_price) : '-'}
                            </td>
                            <td className="border border-slate-300 py-2 px-1 text-center align-middle font-mono font-bold text-sky-800">
                              {row.debit > 0 ? formatMoney(row.debit) : '-'}
                            </td>
                            <td className="border border-slate-300 py-2 px-1 text-center align-middle font-mono font-bold text-rose-700">
                              {row.credit > 0 ? formatMoney(row.credit) : '-'}
                            </td>
                            {/* مقادیر مانده و تشخیص جابجا شدند */}
                            <td className="border border-slate-300 py-2 px-1 text-center align-middle font-mono font-extrabold text-slate-900">
                              {formatMoney(Math.abs(row.running_balance || 0))}
                            </td>
                            <td className="border border-slate-300 py-2 px-1 text-center align-middle font-bold whitespace-nowrap">
                              <span className={rowDiag.textClass}>{rowDiag.label}</span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="overflow-x-auto print:overflow-visible">
                <table className="w-full text-xs border-collapse border border-slate-300 table-fixed">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 text-[10.5px] font-bold">
                      <th className="border border-slate-300 py-2 px-1 text-center align-middle" style={{ width: '4%' }}>ردیف</th>
                      <th className="border border-slate-300 py-2 px-1 text-center align-middle" style={{ width: '9%' }}>شماره سند</th>
                      <th className="border border-slate-300 py-2 px-1 text-center align-middle" style={{ width: '9%' }}>تاریخ</th>
                      <th className="border border-slate-300 py-2 px-2 text-center align-middle" style={{ width: '36%' }}>شرح</th>
                      <th className="border border-slate-300 py-2 px-1 text-center align-middle text-sky-800" style={{ width: '12%' }}>بدهکار (ریال)</th>
                      <th className="border border-slate-300 py-2 px-1 text-center align-middle text-rose-800" style={{ width: '12%' }}>بستانکار (ریال)</th>
                      {/* جابجایی ستون مانده سمت راست و تشخیص سمت چپ در سرجمع اسناد */}
                      <th className="border border-slate-300 py-2 px-1 text-center align-middle font-bold" style={{ width: '11%' }}>مانده (ریال)</th>
                      <th className="border border-slate-300 py-2 px-1 text-center align-middle whitespace-nowrap" style={{ width: '7%' }}>تشخیص</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPersonItems.map((it: any, idx: number) => {
                      const rowDiag = getDiagnosis(it.running_balance || 0);
                      const isRowMatch = Boolean(q && (it.note?.toLowerCase().includes(q) || it.entry?.description?.toLowerCase().includes(q) || it.debit?.toString().includes(q) || it.credit?.toString().includes(q)));
                      return (
                        <tr key={it.id} className={`transition-colors ${isRowMatch ? 'bg-amber-100/80 font-semibold ring-1 ring-amber-400' : 'hover:bg-slate-50'}`}>
                          <td className="border border-slate-300 py-2 px-1 text-center align-middle text-slate-700 font-mono text-xs font-bold">
                            {toPersianDigits(idx + 1)}
                          </td>
                          <td className="border border-slate-300 py-2 px-1 text-center align-middle font-mono font-bold text-sky-800 text-xs">
                            #{toPersianDigits(it.entry.entry_number)}
                          </td>
                          <td className="border border-slate-300 py-2 px-1 text-center align-middle font-mono text-slate-800 text-xs font-bold">
                            {toPersianDigits(it.entry.entry_date_shamsi)}
                          </td>
                          <td className="border border-slate-300 py-2 px-2 text-center align-middle text-slate-900 font-medium truncate">
                            {it.note || it.entry.description || '-'}
                          </td>
                          <td className="border border-slate-300 py-2 px-1 text-center align-middle font-mono font-bold text-sky-800">
                            {it.debit > 0 ? formatMoney(it.debit) : '-'}
                          </td>
                          <td className="border border-slate-300 py-2 px-1 text-center align-middle font-mono font-bold text-rose-700">
                            {it.credit > 0 ? formatMoney(it.credit) : '-'}
                          </td>
                          {/* جابجایی مقادیر مانده و تشخیص */}
                          <td className="border border-slate-300 py-2 px-1 text-center align-middle font-mono font-extrabold text-slate-900">
                            {formatMoney(Math.abs(it.running_balance || 0))}
                          </td>
                          <td className="border border-slate-300 py-2 px-1 text-center align-middle font-bold whitespace-nowrap">
                            <span className={rowDiag.textClass}>{rowDiag.label}</span>
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
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <ListFilter className="w-5 h-5 text-sky-600" />
            <span>لیست جامع تراکنش‌ها</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            مشاهده، ویرایش و مدیریت تمام رویدادهای مالی و مانده لحظه‌ای پس از هر تراکنش
          </p>
        </div>

        <div className="relative w-full md:w-72">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="جستجو در شرح، حساب، مبلغ..."
            className="w-full pl-3 pr-9 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-sky-500 transition-all shadow-2xs"
          />
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
        </div>
      </div>

      {/* تب‌های تفکیک اسناد قطعی و در انتظار */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center p-1 bg-slate-100 rounded-2xl border border-slate-200">
          <button
            onClick={() => setLedgerFilterTab('final')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              ledgerFilterTab === 'final'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            اسناد قطعی و رسمی ({toPersianDigits(finalCount)})
          </button>

          <button
            onClick={() => setLedgerFilterTab('draft')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              ledgerFilterTab === 'draft'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>در انتظار تأیید (پیش‌نویس)</span>
            {draftCount > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold ${
                ledgerFilterTab === 'draft' ? 'bg-white text-amber-900' : 'bg-amber-200 text-amber-900'
              }`}>
                {toPersianDigits(draftCount)}
              </span>
            )}
          </button>

          <button
            onClick={() => setLedgerFilterTab('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              ledgerFilterTab === 'all'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            همه اسناد ({toPersianDigits(entries.length)})
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
          <Filter className="w-4 h-4 text-sky-600" />
          <span>فیلتر تاریخ اسناد:</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">از تاریخ:</span>
          <div className="w-36">
            <ShamsiDatePicker value={fromDate} onChange={setFromDate} compact showTodayButton={false} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">تا تاریخ:</span>
          <div className="w-36">
            <ShamsiDatePicker value={toDate} onChange={setToDate} compact showTodayButton={false} />
          </div>
        </div>
        {(fromDate || toDate) && (
          <button
            onClick={() => { setFromDate(''); setToDate(''); }}
            className="flex items-center gap-1 text-xs text-rose-600 hover:bg-rose-50 px-2.5 py-1.5 rounded-xl font-bold cursor-pointer transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>حذف فیلتر</span>
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/80 text-slate-600 border-b border-slate-200 text-[11px] font-bold">
                <th className="py-3 px-4 text-center align-middle border-l border-slate-200">شماره</th>
                <th className="py-3 px-4 text-center align-middle border-l border-slate-200">تاریخ</th>
                <th className="py-3 px-4 text-center align-middle border-l border-slate-200">از حساب</th>
                <th className="py-3 px-4 text-center align-middle border-l border-slate-200">به حساب</th>
                <th className="py-3 px-4 text-center align-middle border-l border-slate-200">شرح</th>
                <th className="py-3 px-4 text-center align-middle border-l border-slate-200">مبلغ (ریال)</th>
                {/* جابجایی ستون مانده و تشخیص در لیست جامع تراکنش‌ها */}
                <th className="py-3 px-3 text-center align-middle font-bold border-l border-slate-200">مانده (ریال)</th>
                <th className="py-3 px-3 text-center align-middle font-bold border-l border-slate-200">تشخیص</th>
                <th className="py-3 px-3 text-center align-middle">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    هیچ تراکنشی یافت نشد.
                  </td>
                </tr>
              ) : (
                filteredEntries.map((entry) => {
                  const fromAcc = entry.from_account_id ? accountMap.get(entry.from_account_id) : null;
                  const toAcc = entry.to_account_id ? accountMap.get(entry.to_account_id) : null;
                  const totalAmount = entry.items?.reduce((max, i) => Math.max(max, i.debit), 0) || 0;
                  const runningBal = runningBalances.get(entry.id);

                  const isRowMatch = Boolean(
                    q && (
                      entry.description?.toLowerCase().includes(q) ||
                      entry.entry_number.toString().includes(q) ||
                      (fromAcc && fromAcc.name.toLowerCase().includes(q)) ||
                      (toAcc && toAcc.name.toLowerCase().includes(q)) ||
                      totalAmount.toString().includes(q)
                    )
                  );

                  return (
                    <tr
                      key={entry.id}
                      className={`transition-colors ${isRowMatch ? 'bg-amber-100/80 font-semibold ring-1 ring-amber-400' : 'hover:bg-slate-50/70'
                        }`}
                    >
                      <td className="py-3.5 px-3 text-center align-middle font-mono font-bold text-sky-700 border-l border-slate-200 text-xs">
                        #{toPersianDigits(entry.entry_number)}
                      </td>
                      <td className="py-3.5 px-3 text-center align-middle font-mono text-slate-800 border-l border-slate-200 text-xs font-bold">
                        {toPersianDigits(entry.entry_date_shamsi)}
                      </td>
                      <td className="py-3.5 px-3 text-center align-middle font-medium text-slate-800 border-l border-slate-200">
                        {fromAcc ? fromAcc.name : '-'}
                      </td>
                      <td className="py-3.5 px-3 text-center align-middle font-medium text-slate-800 border-l border-slate-200">
                        {toAcc ? toAcc.name : '-'}
                      </td>
                      <td className="py-3.5 px-3 text-center align-middle text-slate-700 border-l border-slate-200">
                        <div className="flex flex-col items-center gap-1">
                          <span>{entry.description || '-'}</span>
                          {entry.status === 'draft' && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold">
                              پیش‌نویس (در انتظار تأیید)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-center align-middle font-mono font-bold text-slate-900 border-l border-slate-200">
                        {formatMoney(totalAmount)}
                      </td>
                      {/* جابجایی مقادیر مانده و تشخیص در ردیف */}
                      <td className="py-3.5 px-3 text-center align-middle font-mono font-extrabold text-slate-800 border-l border-slate-200">
                        {entry.status === 'draft' ? (
                          <span className="text-slate-400 text-xs font-normal">در انتظار</span>
                        ) : runningBal !== undefined ? (
                          formatMoney(Math.abs(runningBal))
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-center align-middle border-l border-slate-200">
                        {entry.status === 'draft' ? (
                          <span className="text-slate-400 text-xs">-</span>
                        ) : runningBal !== undefined ? (() => {
                          const rowDiag = getDiagnosis(runningBal);
                          return <span className={rowDiag.textClass}>{rowDiag.label}</span>;
                        })() : '-'}
                      </td>
                      <td className="py-3.5 px-3 text-center align-middle">
                        <div className="flex items-center justify-center gap-1.5">
                          {entry.status === 'draft' && onFinalizeTransaction && (
                            <button
                              onClick={async () => {
                                await onFinalizeTransaction(entry.id);
                                onRefresh();
                              }}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition-all cursor-pointer shadow-2xs"
                              title="تأیید و ثبت نهایی سند"
                            >
                              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                              <span>تأیید</span>
                            </button>
                          )}
                          {entry.source_type === 'cheque' || Boolean(entry.is_system_generated) ? (
                            <span className="p-1.5 text-amber-500" title="سند چک">
                              <Lock className="w-3.5 h-3.5" />
                            </span>
                          ) : entry.source_type === 'invoice' ? (
                            <span className="p-1.5 text-sky-500" title="سند فاکتور">
                              <Lock className="w-3.5 h-3.5" />
                            </span>
                          ) : (
                            <>
                              <button
                                onClick={() => onEditTransaction(entry)}
                                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                                title="ویرایش"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(entry.id)}
                                className="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                title="حذف"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};