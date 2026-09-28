import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  TrendingUp, 
  TrendingDown, 
  Printer, 
  Trash2, 
  RefreshCw, 
  CheckCircle2, 
  Clock, 
  BarChart3,
  Edit3,
  User
} from 'lucide-react';
import type { 
  Invoice, 
  InvoiceType, 
  Account, 
  Commodity, 
  Warehouse as WarehouseType 
} from '../db/types';
import { 
  getAllInvoices, 
  deleteInvoice 
} from '../db/sqlite';
import { 
  toPersianDigits, 
  separateThousands 
} from '../utils/dateUtils';
import { InvoiceModal } from './InvoiceModal';
import { InvoicePrintModal } from './InvoicePrintModal';
import { ShamsiDateInput } from './ShamsiDateInput';

interface InvoicesTabProps {
  allAccounts: Account[];
  allCommodities: Commodity[];
  allWarehouses: WarehouseType[];
}

export const InvoicesTab: React.FC<InvoicesTabProps> = ({
  allAccounts,
  allCommodities,
  allWarehouses,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'sales' | 'purchases' | 'report'>('sales');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);

  // وضعیت مودال‌ها
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [modalInitialType, setModalInitialType] = useState<InvoiceType>('sale');
  const [invoiceToEdit, setInvoiceToEdit] = useState<Invoice | null>(null);

  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [selectedInvoiceForPrint, setSelectedInvoiceForPrint] = useState<Invoice | null>(null);

  // فیلترها
  const [searchQuery, setSearchQuery] = useState('');
  const [settlementFilter, setSettlementFilter] = useState<string>('all');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [selectedPersonFilter, setSelectedPersonFilter] = useState('');

  const loadInvoices = async () => {
    setLoading(true);
    try {
      const data = await getAllInvoices();
      setInvoices(data);
    } catch (err) {
      console.error('Failed to load invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, []);

  const handleDelete = async (inv: Invoice) => {
    const titlePrefix = inv.type === 'sale' ? 'فاکتور فروش' : 'فاکتور خرید';
    if (
      window.confirm(
        `آیا از حذف ${titlePrefix} شماره ${toPersianDigits(String(inv.invoice_number))} اطمینان دارید؟\nاین عملیات گردش کاردکس انبار، تسویه‌های نقدی/بانکی و سند دوبل متصل را نیز معکوس خواهد کرد.`
      )
    ) {
      try {
        await deleteInvoice(inv.id);
        await loadInvoices();
      } catch (err: any) {
        alert(err.message || 'خطا در حذف فاکتور');
      }
    }
  };

  // آمار کلیدی بالای صفحه
  const stats = useMemo(() => {
    const sales = invoices.filter((i) => i.type === 'sale');
    const purchases = invoices.filter((i) => i.type === 'purchase');

    const totalSalesAmount = sales.reduce((sum, i) => sum + (i.final_amount || 0), 0);
    const totalPurchasesAmount = purchases.reduce((sum, i) => sum + (i.final_amount || 0), 0);

    const salesSettled = sales.reduce((sum, i) => sum + (i.payment_settled_amount || 0), 0);
    const salesRemaining = sales.reduce((sum, i) => sum + (i.payment_remaining_amount || 0), 0);

    const purchasesSettled = purchases.reduce((sum, i) => sum + (i.payment_settled_amount || 0), 0);
    const purchasesRemaining = purchases.reduce((sum, i) => sum + (i.payment_remaining_amount || 0), 0);

    return {
      salesCount: sales.length,
      totalSalesAmount,
      salesSettled,
      salesRemaining,
      purchasesCount: purchases.length,
      totalPurchasesAmount,
      purchasesSettled,
      purchasesRemaining,
    };
  }, [invoices]);

  // فیلتر کردن ردیف‌های فاکتور
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (activeSubTab === 'sales' && inv.type !== 'sale') return false;
      if (activeSubTab === 'purchases' && inv.type !== 'purchase') return false;

      if (settlementFilter !== 'all' && inv.settlement_status !== settlementFilter) return false;
      if (startDateFilter && inv.date_shamsi < startDateFilter) return false;
      if (endDateFilter && inv.date_shamsi > endDateFilter) return false;
      if (selectedPersonFilter && inv.person_id !== selectedPersonFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const numMatch = String(inv.invoice_number).includes(q);
        const personMatch = inv.person_name.toLowerCase().includes(q);
        const descMatch = (inv.description || '').toLowerCase().includes(q);
        const itemMatch = inv.items?.some((it) => it.commodity_name.toLowerCase().includes(q));
        return numMatch || personMatch || descMatch || itemMatch;
      }

      return true;
    });
  }, [invoices, activeSubTab, settlementFilter, startDateFilter, endDateFilter, selectedPersonFilter, searchQuery]);

  const persons = useMemo(() => {
    return allAccounts.filter((a) => a.type === 'person');
  }, [allAccounts]);

  const getSettlementBadge = (status: 'settled' | 'partial' | 'unsettled') => {
    switch (status) {
      case 'settled':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-slate-100 text-slate-800 border border-slate-300">
            تسویه‌شده
          </span>
        );
      case 'partial':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-amber-50 text-amber-900 border border-amber-300">
            نیمه‌تسویه
          </span>
        );
      case 'unsettled':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            نسیه
          </span>
        );
    }
  };

  return (
    <div className="space-y-4 animate-fade-in text-slate-800" dir="rtl">
      
      {/* سربرگ تب‌ها و اقدامات سریع */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl shadow-xs border border-slate-200">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSubTab('sales')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              activeSubTab === 'sales'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <TrendingUp size={15} />
            <span>فاکتورهای فروش</span>
            <span className="bg-white/20 text-white px-2 py-0.2 rounded-full text-[10px] font-mono">
              {toPersianDigits(String(stats.salesCount))}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('purchases')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              activeSubTab === 'purchases'
                ? 'bg-slate-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <TrendingDown size={15} />
            <span>فاکتورهای خرید</span>
            <span className="bg-white/20 text-white px-2 py-0.2 rounded-full text-[10px] font-mono">
              {toPersianDigits(String(stats.purchasesCount))}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('report')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              activeSubTab === 'report'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <BarChart3 size={15} />
            <span>گزارش جامع فاکتورها</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setInvoiceToEdit(null);
              setModalInitialType('sale');
              setIsInvoiceModalOpen(true);
            }}
            className="flex items-center gap-1 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            <Plus size={15} />
            <span>صدور فاکتور فروش</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setInvoiceToEdit(null);
              setModalInitialType('purchase');
              setIsInvoiceModalOpen(true);
            }}
            className="flex items-center gap-1 bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            <Plus size={15} />
            <span>ثبت فاکتور خرید</span>
          </button>

          <button
            type="button"
            onClick={loadInvoices}
            title="بازخوانی داده‌ها"
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* خلاصه ارقام آماری دوره */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
            <span>مجموع فروش دوره</span>
            <TrendingUp size={16} className="text-sky-600" />
          </div>
          <div className="mt-2">
            <span className="text-base font-black text-slate-900 font-mono">
              {separateThousands(String(stats.totalSalesAmount))}
            </span>
            <span className="text-[10px] text-slate-400 mr-1">ریال</span>
            <span className="block text-[10px] text-slate-400 mt-0.5">
              {toPersianDigits(String(stats.salesCount))} فقره فاکتور فروش
            </span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
            <span>مجموع خرید دوره</span>
            <TrendingDown size={16} className="text-slate-600" />
          </div>
          <div className="mt-2">
            <span className="text-base font-black text-slate-900 font-mono">
              {separateThousands(String(stats.totalPurchasesAmount))}
            </span>
            <span className="text-[10px] text-slate-400 mr-1">ریال</span>
            <span className="block text-[10px] text-slate-400 mt-0.5">
              {toPersianDigits(String(stats.purchasesCount))} فقره فاکتور خرید
            </span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-600 font-bold">
            <span>مبالغ تسویه‌شده</span>
            <CheckCircle2 size={16} className="text-slate-600" />
          </div>
          <div className="mt-2">
            <span className="text-base font-black text-slate-900 font-mono">
              {separateThousands(String(stats.salesSettled + stats.purchasesSettled))}
            </span>
            <span className="text-[10px] text-slate-400 mr-1">ریال</span>
            <span className="block text-[10px] text-slate-400 mt-0.5">
              دریافت‌ها و پرداخت‌های نقدی/بانکی/چک
            </span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-rose-700 font-bold">
            <span>مانده حساب‌های نسیه</span>
            <Clock size={16} className="text-rose-600" />
          </div>
          <div className="mt-2">
            <span className="text-base font-black text-rose-700 font-mono">
              {separateThousands(String(stats.salesRemaining + stats.purchasesRemaining))}
            </span>
            <span className="text-[10px] text-slate-400 mr-1">ریال</span>
            <span className="block text-[10px] text-slate-400 mt-0.5">
              طلب از خریداران یا بدهی به تأمین‌کنندگان
            </span>
          </div>
        </div>
      </div>

      {/* نوار فیلترها و جستجو */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex-1 min-w-[220px] relative">
          <Search size={15} className="absolute right-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجو در شماره فاکتور، نام طرف حساب، کالا یا شرح..."
            className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-bold">وضعیت:</span>
            <select
              value={settlementFilter}
              onChange={(e) => setSettlementFilter(e.target.value)}
              className="h-9 bg-slate-50 border border-slate-200 rounded-xl px-2.5 text-xs font-bold text-slate-700 focus:outline-none"
            >
              <option value="all">همه</option>
              <option value="settled">تسویه‌شده</option>
              <option value="partial">نیمه‌تسویه</option>
              <option value="unsettled">نسیه</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-bold">طرف حساب:</span>
            <select
              value={selectedPersonFilter}
              onChange={(e) => setSelectedPersonFilter(e.target.value)}
              className="h-9 bg-slate-50 border border-slate-200 rounded-xl px-2.5 text-xs font-bold text-slate-700 focus:outline-none max-w-[150px]"
            >
              <option value="">همه اشخاص</option>
              {persons.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-bold">از:</span>
            <div className="w-32">
              <ShamsiDateInput value={startDateFilter} onChange={setStartDateFilter} placeholder="آغاز" />
            </div>
            <span className="text-slate-500 font-bold">تا:</span>
            <div className="w-32">
              <ShamsiDateInput value={endDateFilter} onChange={setEndDateFilter} placeholder="پایان" />
            </div>
          </div>

          {(searchQuery || settlementFilter !== 'all' || startDateFilter || endDateFilter || selectedPersonFilter) && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSettlementFilter('all');
                setStartDateFilter('');
                setEndDateFilter('');
                setSelectedPersonFilter('');
              }}
              className="text-xs text-rose-600 hover:text-rose-800 font-bold px-2 py-1 cursor-pointer"
            >
              حذف فیلترها
            </button>
          )}
        </div>
      </div>

      {/* جدول رسمی و ساختاریافته فاکتورها */}
      <div className="bg-white rounded-2xl border border-slate-300 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse border border-slate-300 table-fixed">
            <thead>
              <tr className="bg-slate-100 text-slate-800 text-[11px] font-bold">
                <th className="border border-slate-300 py-2.5 px-1 text-center align-middle" style={{ width: '4%' }}>ردیف</th>
                <th className="border border-slate-300 py-2.5 px-2 text-center align-middle" style={{ width: '8%' }}>شماره فاکتور</th>
                <th className="border border-slate-300 py-2.5 px-2 text-center align-middle" style={{ width: '7%' }}>نوع فاکتور</th>
                <th className="border border-slate-300 py-2.5 px-2 text-center align-middle" style={{ width: '8%' }}>تاریخ</th>
                <th className="border border-slate-300 py-2.5 px-3 text-center align-middle" style={{ width: '18%' }}>طرف حساب</th>
                <th className="border border-slate-300 py-2.5 px-2 text-center align-middle" style={{ width: '10%' }}>انبار</th>
                <th className="border border-slate-300 py-2.5 px-1 text-center align-middle" style={{ width: '5%' }}>اقلام</th>
                <th className="border border-slate-300 py-2.5 px-2 text-center align-middle text-slate-900" style={{ width: '12%' }}>مبلغ کل فاکتور (ریال)</th>
                <th className="border border-slate-300 py-2.5 px-2 text-center align-middle text-rose-700" style={{ width: '11%' }}>مانده نسیه (ریال)</th>
                <th className="border border-slate-300 py-2.5 px-2 text-center align-middle" style={{ width: '7%' }}>وضعیت</th>
                <th className="border border-slate-300 py-2.5 px-2 text-center align-middle" style={{ width: '10%' }}>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={11} className="border border-slate-300 p-10 text-center text-slate-400">
                    هیچ فاکتوری با مشخصات انتخابی یافت نشد.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv, idx) => {
                  const isSale = inv.type === 'sale';
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                      <td className="border border-slate-300 py-2 px-1 text-center align-middle text-slate-500 font-mono text-[10.5px]">
                        {toPersianDigits(idx + 1)}
                      </td>
                      <td className="border border-slate-300 py-2 px-2 text-center align-middle font-mono font-bold text-sky-700 text-xs">
                        #{toPersianDigits(inv.invoice_number)}
                      </td>
                      <td className="border border-slate-300 py-2 px-2 text-center align-middle">
                        <span className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold ${
                          isSale ? 'bg-sky-50 text-sky-800' : 'bg-slate-100 text-slate-800'
                        }`}>
                          {isSale ? 'فروش' : 'خرید'}
                        </span>
                      </td>
                      <td className="border border-slate-300 py-2 px-2 text-center align-middle font-mono text-slate-700 text-[10.5px]">
                        {toPersianDigits(inv.date_shamsi)}
                      </td>
                      
                      {/* تراز وسط مستقل هم برای آیکون‌ها و هم برای نام‌ها */}
                      <td className="border border-slate-300 py-2 px-2 align-middle">
                        <div className="grid grid-cols-[26px_1fr_26px] items-center w-full">
                          <div className="w-5.5 h-5.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 flex items-center justify-center justify-self-center shadow-2xs">
                            <User size={12} />
                          </div>
                          <span className="text-center font-bold text-slate-900 text-xs truncate px-1">
                            {inv.person_name}
                          </span>
                          <div className="w-5.5" /> {/* بالانسر خالی جهت حفظ سنتر بودن کامل متن نسبت به کل ستون */}
                        </div>
                      </td>

                      <td className="border border-slate-300 py-2 px-2 text-center align-middle text-slate-600 truncate">
                        {inv.warehouse_name || '-'}
                      </td>
                      <td className="border border-slate-300 py-2 px-1 text-center align-middle font-mono text-slate-700">
                        {toPersianDigits(inv.items?.length || 0)}
                      </td>
                      <td className="border border-slate-300 py-2 px-2 text-center align-middle font-mono font-black text-slate-900">
                        {separateThousands(String(inv.final_amount))}
                      </td>
                      <td className="border border-slate-300 py-2 px-2 text-center align-middle font-mono font-bold text-rose-700">
                        {inv.payment_remaining_amount > 0 ? separateThousands(String(inv.payment_remaining_amount)) : '۰'}
                      </td>
                      <td className="border border-slate-300 py-2 px-2 text-center align-middle">
                        {getSettlementBadge(inv.settlement_status)}
                      </td>
                      <td className="border border-slate-300 py-2 px-2 text-center align-middle">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setInvoiceToEdit(inv);
                              setModalInitialType(inv.type);
                              setIsInvoiceModalOpen(true);
                            }}
                            title="ویرایش فاکتور"
                            className="p-1 rounded-lg text-slate-600 hover:text-sky-700 hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            <Edit3 size={14} />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedInvoiceForPrint(inv);
                              setIsPrintModalOpen(true);
                            }}
                            title="چاپ فاکتور"
                            className="p-1 rounded-lg text-slate-600 hover:text-sky-700 hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            <Printer size={14} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDelete(inv)}
                            title="حذف فاکتور"
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
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

      {/* مودال‌های فاکتور و چاپ */}
      <InvoiceModal
        isOpen={isInvoiceModalOpen}
        onClose={() => {
          setIsInvoiceModalOpen(false);
          setInvoiceToEdit(null);
        }}
        onSaved={() => {
          loadInvoices();
          setInvoiceToEdit(null);
        }}
        initialType={modalInitialType}
        invoiceToEdit={invoiceToEdit}
        allAccounts={allAccounts}
        allCommodities={allCommodities}
        allWarehouses={allWarehouses}
      />

      <InvoicePrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        invoice={selectedInvoiceForPrint}
      />

    </div>
  );
};