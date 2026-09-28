import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Layers, 
  Search, 
  Printer, 
  FileText, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Boxes
} from 'lucide-react';
import type { Commodity, CommodityGroup, CommodityTransaction, Warehouse } from '../db/types';
import { getCommodityGroupTransactions } from '../db/sqlite';
import { toPersianDigits, formatMoney } from '../utils/dateUtils';
import { ShamsiDateInput } from './ShamsiDateInput';

interface CommodityGroupReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: CommodityGroup | null;
  commodities: Commodity[];
  warehouses: Warehouse[];
  onOpenCommodityKardex?: (commodity: Commodity) => void;
}

export const CommodityGroupReportModal: React.FC<CommodityGroupReportModalProps> = ({
  isOpen,
  onClose,
  group,
  commodities,
  warehouses,
  onOpenCommodityKardex,
}) => {
  const [activeTab, setActiveTab] = useState<'items' | 'movements'>('items');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [groupTransactions, setGroupTransactions] = useState<
    (CommodityTransaction & { commodity_name: string; commodity_code: number; commodity_unit: string })[]
  >([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);

  // Warehouse Map for fast lookups
  const warehouseMap = useMemo(() => {
    const map = new Map<string, Warehouse>();
    for (const w of warehouses) map.set(w.id, w);
    return map;
  }, [warehouses]);

  // Commodities belonging to this group
  const groupCommodities = useMemo(() => {
    if (!group) return [];
    return commodities.filter((c) => c.group_id === group.id);
  }, [commodities, group]);

  useEffect(() => {
    if (isOpen && group) {
      loadTransactions();
    }
  }, [isOpen, group]);

  const loadTransactions = async () => {
    if (!group) return;
    setIsLoadingTransactions(true);
    try {
      const list = await getCommodityGroupTransactions(group.id, {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setGroupTransactions(list);
    } catch (err) {
      console.error('Failed to load group transactions:', err);
    } finally {
      setIsLoadingTransactions(false);
    }
  };

  const handleApplyFilter = () => {
    loadTransactions();
  };

  const handleResetFilter = () => {
    setStartDate('');
    setEndDate('');
    setSearchQuery('');
    if (group) {
      getCommodityGroupTransactions(group.id).then(setGroupTransactions);
    }
  };

  // Filtered commodities list by search
  const filteredCommodities = useMemo(() => {
    if (!searchQuery.trim()) return groupCommodities;
    const q = searchQuery.trim().toLowerCase();
    return groupCommodities.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        String(c.code).includes(q) ||
        (c.barcode && c.barcode.toLowerCase().includes(q))
    );
  }, [groupCommodities, searchQuery]);

  // Filtered transactions by search
  const filteredTransactions = useMemo(() => {
    if (!searchQuery.trim()) return groupTransactions;
    const q = searchQuery.trim().toLowerCase();
    return groupTransactions.filter(
      (t) =>
        t.commodity_name.toLowerCase().includes(q) ||
        String(t.commodity_code).includes(q) ||
        (t.description && t.description.toLowerCase().includes(q)) ||
        (t.reference && t.reference.toLowerCase().includes(q)) ||
        (t.date_shamsi && t.date_shamsi.includes(q))
    );
  }, [groupTransactions, searchQuery]);

  // KPIs
  const totalItemsCount = groupCommodities.length;
  const totalStockQuantity = useMemo(() => {
    return groupCommodities.reduce((sum, c) => sum + (c.current_quantity || 0), 0);
  }, [groupCommodities]);

  const totalEstimatedValue = useMemo(() => {
    return groupCommodities.reduce((sum, c) => {
      const price = c.sales_price || c.purchase_price || 0;
      return sum + (c.current_quantity || 0) * price;
    }, 0);
  }, [groupCommodities]);

  const totalIn = useMemo(() => {
    return filteredTransactions
      .filter((t) => t.type === 'in' || t.type === 'initial')
      .reduce((sum, t) => sum + (t.quantity || 0), 0);
  }, [filteredTransactions]);

  const totalOut = useMemo(() => {
    return filteredTransactions
      .filter((t) => t.type === 'out')
      .reduce((sum, t) => sum + (t.quantity || 0), 0);
  }, [filteredTransactions]);

  if (!isOpen || !group) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden transition-all animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-sky-50 to-white">
          <div className="flex items-center gap-3">
            <div 
              className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-md shrink-0 border border-slate-200"
              style={{ backgroundColor: `${group.color}20`, color: group.color }}
            >
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  گزارش سرفصل: {group.name}
                </h2>
                <span 
                  className="text-xs px-2.5 py-0.5 rounded-full font-bold border"
                  style={{
                    backgroundColor: `${group.color}15`,
                    color: group.color,
                    borderColor: `${group.color}40`,
                  }}
                >
                  {toPersianDigits(totalItemsCount)} قلم کالا
                </span>
              </div>
              <span className="text-[11px] text-slate-500 block mt-0.5">
                گزارش تفکیکی اقلام، مجموع موجودی فیزیکی و گردش‌های کاردکس این گروه
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
              title="چاپ گزارش گروه"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Section: Date Range & Search */}
        <div className="p-4 bg-slate-50/80 border-b border-slate-200/80 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Start Date */}
            <div>
              <ShamsiDateInput
                label="از تاریخ (شمسی)"
                value={startDate}
                onChange={setStartDate}
                placeholder="مثال: ۱۴۰۵/۰۱/۰۱"
              />
            </div>

            {/* End Date */}
            <div>
              <ShamsiDateInput
                label="تا تاریخ (شمسی)"
                value={endDate}
                onChange={setEndDate}
                placeholder="مثال: ۱۴۰۵/۱۲/۲۹"
              />
            </div>

            {/* Search within Report */}
            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">
                جستجو در اقلام یا گردش‌ها
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="نام کالا، کد، شرح..."
                  className="w-full text-xs pl-3 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-sky-500 text-right"
                />
                <Search className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5" />
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleApplyFilter}
                className="px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                اعمال فیلتر تاریخ
              </button>
              <button
                type="button"
                onClick={handleResetFilter}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-white text-xs font-semibold transition-colors cursor-pointer"
              >
                حذف فیلترها
              </button>
            </div>

            {/* Sub-Tabs: Items vs Movements */}
            <div className="flex gap-1.5 p-1 bg-slate-200/70 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab('items')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'items'
                    ? 'bg-white text-sky-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                اقلام این گروه ({toPersianDigits(filteredCommodities.length)})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('movements')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'movements'
                    ? 'bg-white text-sky-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                گردش‌های کاردکس ({toPersianDigits(filteredTransactions.length)})
              </button>
            </div>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 p-4 bg-slate-50/40 border-b border-slate-200/80">
          <div className="bg-white p-3 rounded-xl border border-slate-200/70 shadow-2xs">
            <span className="text-[11px] text-slate-400 block font-semibold">تعداد اقلام کالا</span>
            <span className="text-sm font-bold font-mono text-slate-800">
              {toPersianDigits(totalItemsCount)} <span className="text-[10px] font-normal font-sans text-slate-500">قلم</span>
            </span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200/70 shadow-2xs">
            <span className="text-[11px] text-slate-400 block font-semibold">مجموع موجودی انبار</span>
            <span className="text-sm font-bold font-mono text-emerald-700">
              {toPersianDigits(totalStockQuantity)}
            </span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200/70 shadow-2xs">
            <span className="text-[11px] text-slate-400 block font-semibold">کل ورودی دوره</span>
            <span className="text-sm font-bold font-mono text-sky-700">
              +{toPersianDigits(totalIn)}
            </span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200/70 shadow-2xs">
            <span className="text-[11px] text-slate-400 block font-semibold">کل خروجی دوره</span>
            <span className="text-sm font-bold font-mono text-rose-600">
              -{toPersianDigits(totalOut)}
            </span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200/70 shadow-2xs col-span-2 sm:col-span-1">
            <span className="text-[11px] text-slate-400 block font-semibold">ارزش تقریبی موجودی</span>
            <span className="text-sm font-bold font-mono text-indigo-700">
              {formatMoney(totalEstimatedValue)} <span className="text-[10px] font-normal font-sans text-slate-500">ریال</span>
            </span>
          </div>
        </div>

        {/* Tab 1: Commodities in this group */}
        {activeTab === 'items' && (
          <div className="flex-1 overflow-y-auto p-4">
            {filteredCommodities.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <Boxes className="w-10 h-10 mx-auto text-slate-300 stroke-[1.5]" />
                <p className="text-xs font-bold text-slate-600">
                  {searchQuery ? 'کالایی با این مشخصات در این گروه یافت نشد.' : 'هنوز کالایی در این گروه تعریف نشده است.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
                <table className="w-full text-xs text-center border-collapse">
                  <thead>
                    <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                      <th className="py-2.5 px-3">کد کالا</th>
                      <th className="py-2.5 px-3 text-right">نام کالا</th>
                      <th className="py-2.5 px-3">بارکد</th>
                      <th className="py-2.5 px-3">انبار اختصاصی</th>
                      <th className="py-2.5 px-3">موجودی فعلی</th>
                      <th className="py-2.5 px-3">قیمت فروش</th>
                      <th className="py-2.5 px-3">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCommodities.map((c) => {
                      const wh = warehouseMap.get(c.warehouse_id);
                      const hasStock = (c.current_quantity || 0) > 0;

                      return (
                        <tr key={c.id} className="hover:bg-sky-50/30 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-bold text-sky-800">
                            {toPersianDigits(c.code)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                            {c.name}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-500">
                            {c.barcode || '—'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {wh?.name || '—'}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2.5 py-0.5 rounded-lg font-mono font-bold text-xs ${
                              hasStock ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {toPersianDigits(c.current_quantity || 0)} {c.unit}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-700">
                            {c.sales_price ? `${formatMoney(c.sales_price)} ریال` : '—'}
                          </td>
                          <td className="py-2.5 px-3">
                            {onOpenCommodityKardex && (
                              <button
                                type="button"
                                onClick={() => {
                                  onClose();
                                  onOpenCommodityKardex(c);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-sky-50 hover:border-sky-300 text-sky-700 text-[11px] font-bold transition-all cursor-pointer shadow-2xs"
                                title="مشاهده کاردکس اختصاصی این کالا"
                              >
                                <FileText className="w-3 h-3" />
                                <span>کاردکس</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Aggregated Movements in this group */}
        {activeTab === 'movements' && (
          <div className="flex-1 overflow-y-auto p-4">
            {isLoadingTransactions ? (
              <div className="py-12 text-center text-slate-400 text-xs font-semibold">
                در حال بارگذاری گردش‌های کاردکس...
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <Boxes className="w-10 h-10 mx-auto text-slate-300 stroke-[1.5]" />
                <p className="text-xs font-bold text-slate-600">
                  هیچ گردشی برای اقلام این گروه در این بازه تاریخی یافت نشد.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
                <table className="w-full text-xs text-center border-collapse">
                  <thead>
                    <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                      <th className="py-2.5 px-3">ردیف</th>
                      <th className="py-2.5 px-3">تاریخ</th>
                      <th className="py-2.5 px-3 text-right">کالا</th>
                      <th className="py-2.5 px-3">انبار</th>
                      <th className="py-2.5 px-3">نوع رویداد</th>
                      <th className="py-2.5 px-3">تعداد</th>
                      <th className="py-2.5 px-3">مرجع / سند</th>
                      <th className="py-2.5 px-3 text-right">شرح</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTransactions.map((t, idx) => {
                      const wh = warehouseMap.get(t.warehouse_id);
                      const isEntry = t.type === 'in' || t.type === 'initial';

                      return (
                        <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-3 font-mono text-slate-400">
                            {toPersianDigits(idx + 1)}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-700">
                            {t.date_shamsi || '—'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-800">
                            <span className="font-mono text-[10px] text-sky-700 ml-1">
                              [{toPersianDigits(t.commodity_code)}]
                            </span>
                            {t.commodity_name}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {wh?.name || '—'}
                          </td>
                          <td className="py-2.5 px-3">
                            {t.type === 'initial' ? (
                              <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                موجودی اولیه
                              </span>
                            ) : isEntry ? (
                              <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <ArrowDownLeft className="w-3 h-3" />
                                ورود
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                <ArrowUpRight className="w-3 h-3" />
                                خروج
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-xs">
                            <span className={isEntry ? 'text-emerald-700' : 'text-rose-600'}>
                              {isEntry ? '+' : '-'}{toPersianDigits(t.quantity)} {t.commodity_unit}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                            {t.reference || '—'}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-600 truncate max-w-xs">
                            {t.description || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
