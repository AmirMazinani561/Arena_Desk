import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Package, 
  Search, 
  Printer, 
  Boxes, 
  Warehouse as WarehouseIcon, 
  Layers, 
  Barcode 
} from 'lucide-react';
import type { Commodity, CommodityTransaction, Warehouse, CommodityGroup } from '../db/types';
import { getCommodityTransactions } from '../db/sqlite';
import { toPersianDigits, getCurrentShamsi } from '../utils/dateUtils';
import { ShamsiDatePicker } from './ShamsiDatePicker';

// تابع کمکی اختصاصی برای حذف خطای ممیز شناور جاوااسکریپت و نمایش ارقام اعشاری تمیز
function cleanQuantity(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === '') return '۰';
  const num = parseFloat(String(val));
  if (isNaN(num)) return '۰';
  const rounded = Math.round((num + Number.EPSILON) * 1000) / 1000;
  return toPersianDigits(rounded.toString());
}

interface CommodityReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  commodity: Commodity | null;
  warehouse: Warehouse | null;
  group: CommodityGroup | null;
}

export const CommodityReportModal: React.FC<CommodityReportModalProps> = ({
  isOpen,
  onClose,
  commodity,
  warehouse,
  group,
}) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [transactions, setTransactions] = useState<CommodityTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && commodity) {
      loadKardex();
    }
  }, [isOpen, commodity]);

  const loadKardex = async () => {
    if (!commodity) return;
    setIsLoading(true);
    try {
      const list = await getCommodityTransactions(commodity.id);
      setTransactions(list);
    } catch (err) {
      console.error('Failed to load commodity kardex:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyFilter = async () => {
    if (!commodity) return;
    setIsLoading(true);
    try {
      const list = await getCommodityTransactions(commodity.id, {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setTransactions(list);
    } catch (err) {
      console.error('Failed to apply filter:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetFilter = () => {
    setStartDate('');
    setEndDate('');
    setSearchQuery('');
    loadKardex();
  };

  const filteredTransactions = useMemo(() => {
    if (!searchQuery.trim()) return transactions;
    const q = searchQuery.trim().toLowerCase();
    return transactions.filter(
      (t) =>
        (t.description && t.description.toLowerCase().includes(q)) ||
        (t.reference && t.reference.toLowerCase().includes(q)) ||
        (t.date_shamsi && t.date_shamsi.includes(q))
    );
  }, [transactions, searchQuery]);

  const totalIn = useMemo(() => {
    const sum = filteredTransactions
      .filter((t) => t.type === 'in' || t.type === 'initial')
      .reduce((s, t) => s + (t.quantity || 0), 0);
    return Math.round((sum + Number.EPSILON) * 1000) / 1000;
  }, [filteredTransactions]);

  const totalOut = useMemo(() => {
    const sum = filteredTransactions
      .filter((t) => t.type === 'out')
      .reduce((s, t) => s + (t.quantity || 0), 0);
    return Math.round((sum + Number.EPSILON) * 1000) / 1000;
  }, [filteredTransactions]);

  if (!isOpen || !commodity) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs" dir="rtl">
      <div className="bg-white rounded-2xl border border-slate-300 shadow-2xl w-[90vw] max-w-7xl h-[90vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
        
        {/* هدر بالایی: مشخصات کالا */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col gap-3 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-xs shrink-0">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-extrabold text-slate-900">
                    کاردکس کالا: {commodity.name}
                  </h2>
                  <span className="text-[11px] px-2 py-0.5 rounded-md font-mono font-bold bg-white text-sky-800 border border-slate-300">
                    کد: {toPersianDigits(commodity.code)}
                  </span>
                  {commodity.barcode && (
                    <span className="text-[10px] px-2 py-0.5 rounded-md font-mono bg-white text-slate-600 border border-slate-300 flex items-center gap-1">
                      <Barcode className="w-3 h-3 text-slate-400" />
                      {commodity.barcode}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1 font-medium">
                  {warehouse && (
                    <span className="flex items-center gap-1">
                      <WarehouseIcon className="w-3.5 h-3.5 text-slate-400" />
                      انبار: {warehouse.name}
                    </span>
                  )}
                  {group && (
                    <span className="flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-slate-400" />
                      گروه: {group.name}
                    </span>
                  )}
                  <span>واحد: <strong className="text-slate-700">{commodity.unit}</strong></span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="p-2 rounded-xl text-slate-600 hover:bg-slate-200 border border-slate-300 bg-white transition-colors cursor-pointer"
                title="چاپ کاردکس"
              >
                <Printer className="w-4 h-4 text-sky-600" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* فیلتر تاریخ و جستجو */}
          <div className="pt-2.5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2.5">
              
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-bold shrink-0">از:</span>
                <div className="w-52">
                  <ShamsiDatePicker
                    value={startDate}
                    onChange={setStartDate}
                    compact
                    showTodayButton={false}
                  />
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-bold shrink-0">تا:</span>
                <div className="w-52">
                  <ShamsiDatePicker
                    value={endDate}
                    onChange={setEndDate}
                    compact
                    showTodayButton={false}
                  />
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleApplyFilter}
                  className="h-9 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-2xs transition-all cursor-pointer flex items-center justify-center"
                >
                  فیلتر
                </button>
                {(startDate || endDate || searchQuery) && (
                  <button
                    type="button"
                    onClick={handleResetFilter}
                    className="h-9 px-2.5 text-rose-600 hover:text-rose-800 font-bold cursor-pointer transition-colors flex items-center justify-center"
                  >
                    حذف فیلتر
                  </button>
                )}
              </div>
            </div>

            <div className="relative w-52">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجو در شرح یا مرجع..."
                className="w-full h-9 text-xs pl-3 pr-8 rounded-xl border border-slate-300 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-sky-500 shadow-2xs"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* جدول گردش‌های کاردکس کالا */}
        <div className="flex-1 overflow-y-auto p-4 bg-white">
          {isLoading ? (
            <div className="py-16 text-center text-slate-400 text-xs font-semibold">
              در حال بارگذاری کاردکس کالا...
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <Boxes className="w-12 h-12 mx-auto text-slate-300 stroke-[1.5]" />
              <p className="text-xs font-bold text-slate-600">گردشی برای این کالا ثبت نشده است.</p>
            </div>
          ) : (
            <div className="border border-slate-300 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-xs border-collapse border border-slate-300 table-fixed">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 text-[11px] font-bold">
                    <th className="border border-slate-300 py-3 px-1 text-center align-middle" style={{ width: '5%' }}>ردیف</th>
                    <th className="border border-slate-300 py-3 px-2 text-center align-middle" style={{ width: '12%' }}>تاریخ</th>
                    <th className="border border-slate-300 py-3 px-2 text-center align-middle" style={{ width: '12%' }}>نوع رویداد</th>
                    <th className="border border-slate-300 py-3 px-2 text-center align-middle" style={{ width: '12%' }}>مقدار</th>
                    <th className="border border-slate-300 py-3 px-2 text-center align-middle font-extrabold text-slate-900" style={{ width: '14%' }}>مانده کاردکس</th>
                    <th className="border border-slate-300 py-3 px-2 text-center align-middle" style={{ width: '15%' }}>شماره مرجع</th>
                    <th className="border border-slate-300 py-3 px-3 text-center align-middle" style={{ width: '30%' }}>شرح عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredTransactions.map((tx, idx) => (
                    <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                      <td className="border border-slate-300 py-2.5 px-1 text-center align-middle font-mono font-bold text-slate-700 text-xs">
                        {toPersianDigits(idx + 1)}
                      </td>
                      <td className="border border-slate-300 py-2.5 px-2 text-center align-middle font-mono font-bold text-slate-800 text-xs">
                        {toPersianDigits(tx.date_shamsi)}
                      </td>
                      <td className="border border-slate-300 py-2.5 px-2 text-center align-middle">
                        <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${
                          tx.type === 'initial'
                            ? 'bg-slate-100 text-slate-700'
                            : tx.type === 'in'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : tx.type === 'out'
                            ? 'bg-rose-50 text-rose-800 border border-rose-200'
                            : 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                        }`}>
                          {tx.type === 'initial' ? 'موجودی اولیه' : tx.type === 'in' ? 'ورود به انبار' : tx.type === 'out' ? 'خروج از انبار' : 'انتقال'}
                        </span>
                      </td>
                      <td className="border border-slate-300 py-2.5 px-2 text-center align-middle font-mono font-bold text-xs">
                        <span className={tx.type === 'out' ? 'text-rose-700' : 'text-emerald-700'}>
                          {tx.type === 'out' ? '-' : '+'}{cleanQuantity(tx.quantity)}
                        </span>
                      </td>
                      <td className="border border-slate-300 py-2.5 px-2 text-center align-middle font-mono font-extrabold text-slate-900 text-xs">
                        {cleanQuantity(tx.balance_after)}
                      </td>
                      <td className="border border-slate-300 py-2.5 px-2 text-center align-middle font-mono text-slate-600 text-xs">
                        {tx.reference ? toPersianDigits(tx.reference) : '-'}
                      </td>
                      <td className="border border-slate-300 py-2.5 px-3 text-center align-middle text-slate-700 text-xs truncate">
                        {tx.description || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ۴ شاخص آماری در پایین پنجره */}
        <div className="border-t border-slate-300 bg-slate-50/70 p-4 space-y-3 shrink-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-center">
            
            {/* موجودی اولیه */}
            <div className="bg-white p-3 rounded-xl border border-slate-300 shadow-2xs flex flex-col justify-center">
              <span className="text-[11px] text-slate-500 font-bold block mb-1">موجودی اولیه کالا</span>
              <div className="font-mono font-bold text-slate-800 text-sm">
                {cleanQuantity(commodity.initial_quantity || 0)} <span className="text-xs text-slate-400 font-sans">{commodity.unit}</span>
              </div>
            </div>

            {/* مجموع وارده */}
            <div className="bg-white p-3 rounded-xl border border-emerald-300 shadow-2xs flex flex-col justify-center">
              <span className="text-[11px] text-emerald-700 font-bold block mb-1">مجموع وارده (+)</span>
              <div className="font-mono font-bold text-emerald-800 text-sm">
                {cleanQuantity(totalIn)} <span className="text-xs text-emerald-600/70 font-sans">{commodity.unit}</span>
              </div>
            </div>

            {/* مجموع صادره */}
            <div className="bg-white p-3 rounded-xl border border-rose-300 shadow-2xs flex flex-col justify-center">
              <span className="text-[11px] text-rose-700 font-bold block mb-1">مجموع صادره (-)</span>
              <div className="font-mono font-bold text-rose-800 text-sm">
                {cleanQuantity(totalOut)} <span className="text-xs text-rose-600/70 font-sans">{commodity.unit}</span>
              </div>
            </div>

            {/* موجودی لحظه‌ای نهایی */}
            <div className="bg-sky-50/80 p-3 rounded-xl border border-sky-300 shadow-2xs flex flex-col justify-center">
              <span className="text-[11px] text-sky-800 font-extrabold block mb-1">موجودی لحظه‌ای نهایی</span>
              <div className="font-mono font-extrabold text-sky-950 text-base">
                {cleanQuantity(commodity.current_quantity ?? commodity.initial_quantity ?? 0)} <span className="text-xs text-sky-700 font-normal font-sans">{commodity.unit}</span>
              </div>
            </div>

          </div>

          <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
            <div className="text-[11px] text-slate-500 font-medium">
              تعداد گردش‌های کاردکس: <strong className="font-mono text-slate-800">{toPersianDigits(filteredTransactions.length)}</strong> | تاریخ گزارش: {toPersianDigits(getCurrentShamsi().formatted)}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-bold transition-colors cursor-pointer shadow-2xs"
            >
              بستن پنجره
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};