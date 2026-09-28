import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Warehouse as WarehouseIcon, 
  Package, 
  Search, 
  Printer, 
  Boxes, 
  ArrowDownLeft, 
  Filter 
} from 'lucide-react';
import type { Warehouse, Commodity, WarehouseReportItem } from '../db/types';
import { getWarehouseCommodities, getWarehouseReport } from '../db/sqlite';
import { toPersianDigits, getCurrentShamsi } from '../utils/dateUtils';
import { SearchableCommoditySelect } from './SearchableCommoditySelect';
import { ShamsiDateInput } from './ShamsiDateInput';

interface WarehouseReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  warehouse: Warehouse | null;
}

export const WarehouseReportModal: React.FC<WarehouseReportModalProps> = ({
  isOpen,
  onClose,
  warehouse,
}) => {
  const [commodities, setCommodities] = useState<Commodity[]>([]);
  const [selectedCommodityId, setSelectedCommodityId] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [reportItems, setReportItems] = useState<WarehouseReportItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && warehouse) {
      loadData();
    }
  }, [isOpen, warehouse]);

  const loadData = async () => {
    if (!warehouse) return;
    setIsLoading(true);
    try {
      const comms = await getWarehouseCommodities(warehouse.id);
      setCommodities(comms);
      const rep = await getWarehouseReport(warehouse.id);
      setReportItems(rep);
    } catch (err) {
      console.error('Failed to load warehouse report data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyFilter = async () => {
    if (!warehouse) return;
    setIsLoading(true);
    try {
      const rep = await getWarehouseReport(warehouse.id, {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        commodityId: selectedCommodityId === 'all' ? undefined : selectedCommodityId,
      });
      setReportItems(rep);
    } catch (err) {
      console.error('Failed to apply report filters:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetFilter = () => {
    setStartDate('');
    setEndDate('');
    setSelectedCommodityId('all');
    setSearchQuery('');
    loadData();
  };

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return reportItems;
    const q = searchQuery.trim().toLowerCase();
    return reportItems.filter(
      (item) =>
        item.commodity_name.toLowerCase().includes(q) ||
        String(item.commodity_code).toLowerCase().includes(q) ||
        (item.description && item.description.toLowerCase().includes(q))
    );
  }, [reportItems, searchQuery]);

  const totalQuantity = useMemo(() => {
    return filteredItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
  }, [filteredItems]);

  if (!isOpen || !warehouse) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden transition-all animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-sky-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-sky-600 text-white flex items-center justify-center shadow-md shadow-sky-600/20">
              <WarehouseIcon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  گزارش کاردکس و موجودی: {warehouse.name}
                </h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-sky-100 text-sky-800 border border-sky-200">
                  کد {toPersianDigits(warehouse.code)}
                </span>
              </div>
              <span className="text-[11px] text-slate-500 block mt-0.5">
                {warehouse.address ? `موقعیت: ${warehouse.address}` : 'فیلتر بر اساس تاریخ و اقلام کالا'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
              title="چاپ گزارش"
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

        {/* Filter Toolbar */}
        <div className="p-4 bg-slate-50/80 border-b border-slate-200/80 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Commodity Filter with Live Search */}
            <div>
              <SearchableCommoditySelect
                label="فیلتر کالا (با قابلیت جستجو)"
                commodities={commodities}
                selectedId={selectedCommodityId}
                onSelect={(id) => setSelectedCommodityId(id)}
                placeholder="جستجو در اقلام این انبار..."
                allLabel="همه کالاها و اقلام"
              />
            </div>

            {/* Date Range: From */}
            <div>
              <ShamsiDateInput
                label="از تاریخ (شمسی)"
                value={startDate}
                onChange={setStartDate}
                placeholder="مثال: ۱۴۰۵/۰۱/۰۱"
              />
            </div>

            {/* Date Range: To */}
            <div>
              <ShamsiDateInput
                label="تا تاریخ (شمسی)"
                value={endDate}
                onChange={setEndDate}
                placeholder="مثال: ۱۴۰۵/۱۲/۲۹"
              />
            </div>
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleApplyFilter}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <Filter className="w-3.5 h-3.5" />
                <span>اعمال فیلتر</span>
              </button>
              <button
                type="button"
                onClick={handleResetFilter}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-white text-xs font-semibold transition-colors cursor-pointer"
              >
                حذف فیلترها
              </button>
            </div>

            {/* In-table Search */}
            <div className="relative w-48 sm:w-64">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجو در اقلام..."
                className="w-full text-xs pl-3 pr-8 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-sky-500 text-right"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2" />
            </div>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="p-4 grid grid-cols-3 gap-3 bg-white border-b border-slate-100">
          <div className="p-3 rounded-2xl bg-sky-50/60 border border-sky-100 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-500 block">تعداد اقلام کالا</span>
              <span className="text-sm font-extrabold text-sky-800 font-mono">
                {toPersianDigits(commodities.length)} قلم
              </span>
            </div>
            <Boxes className="w-6 h-6 text-sky-600 opacity-60" />
          </div>

          <div className="p-3 rounded-2xl bg-emerald-50/60 border border-emerald-100 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-500 block">مجموع موجودی انبار</span>
              <span className="text-sm font-extrabold text-emerald-800 font-mono">
                {toPersianDigits(totalQuantity)}
              </span>
            </div>
            <Package className="w-6 h-6 text-emerald-600 opacity-60" />
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-500 block">وضعیت انبار</span>
              <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                فعال و عملیاتی
              </span>
            </div>
            <WarehouseIcon className="w-6 h-6 text-slate-400" />
          </div>
        </div>

        {/* Report Content Table */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="py-12 text-center text-slate-400 text-xs font-semibold">
              در حال آماده‌سازی گزارش انبار...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <Boxes className="w-12 h-12 mx-auto text-slate-300 stroke-[1.5]" />
              <p className="text-xs font-bold text-slate-600">هنوز کالایی در این انبار ثبت نشده است.</p>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                در فاز بعدی (تعریف کالاها)، اقلام به این انبار اختصاص می‌یابند و کاردکس ورودی، خروجی و مانده در این بخش نمایش داده خواهد شد.
              </p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <tr>
                    <th className="p-3">ردیف</th>
                    <th className="p-3">کد کالا</th>
                    <th className="p-3">نام کالا</th>
                    <th className="p-3 text-center">نوع عملیات</th>
                    <th className="p-3 text-center">تعداد / مقدار</th>
                    <th className="p-3">واحد سنجش</th>
                    <th className="p-3">تاریخ ثبت</th>
                    <th className="p-3">شرح / مرجع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredItems.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-3 font-mono font-bold text-slate-400">{toPersianDigits(idx + 1)}</td>
                      <td className="p-3 font-mono font-bold text-sky-700">{toPersianDigits(item.commodity_code)}</td>
                      <td className="p-3 font-bold text-slate-900">{item.commodity_name}</td>
                      <td className="p-3 text-center">
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <ArrowDownLeft className="w-3 h-3" />
                          موجودی
                        </span>
                      </td>
                      <td className="p-3 text-center font-mono font-bold text-slate-900 text-sm">
                        {toPersianDigits(item.quantity)}
                      </td>
                      <td className="p-3 text-slate-500">{item.unit}</td>
                      <td className="p-3 font-mono text-[11px] text-slate-500">{toPersianDigits(item.date_shamsi)}</td>
                      <td className="p-3 text-slate-500 text-[11px]">{item.description || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="text-[11px] text-slate-500">
            گزارش رسمی انبارداری Arena Desk | تاریخ گزارش: {toPersianDigits(getCurrentShamsi().fullText)}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
          >
            بستن پنجره
          </button>
        </div>
      </div>
    </div>
  );
};
