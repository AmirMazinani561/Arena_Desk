import React, { useState, useEffect, useMemo } from 'react';
import { 
  Flame, 
  Plus, 
  Search, 
  Trash2, 
  RefreshCw, 
  Percent, 
  Layers, 
  ArrowRightLeft,
  Edit3,
  Eye
} from 'lucide-react';
import type { ProductionOrder, Commodity, Warehouse } from '../db/types';
import { getAllProductionOrders, deleteProductionOrder, initProductionTables } from '../db/sqlite';
import { toPersianDigits, separateThousands } from '../utils/dateUtils';
import { ProductionModal } from './ProductionModal';
import { ProductionViewModal } from './ProductionViewModal';

interface ProductionTabProps {
  commodities: Commodity[];
  warehouses: Warehouse[];
  onRefreshCommodities?: () => void;
}

export const ProductionTab: React.FC<ProductionTabProps> = ({
  commodities,
  warehouses,
  onRefreshCommodities,
}) => {
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [orderToEdit, setOrderToEdit] = useState<ProductionOrder | null>(null);
  const [orderToView, setOrderToView] = useState<ProductionOrder | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const loadOrders = async () => {
    setLoading(true);
    try {
      await initProductionTables();
      const list = await getAllProductionOrders();
      setOrders(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const handleOpenCreate = () => {
    setOrderToEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (order: ProductionOrder) => {
    setOrderToEdit(order);
    setIsModalOpen(true);
  };

  const handleOpenView = (order: ProductionOrder) => {
    setOrderToView(order);
    setIsViewModalOpen(true);
  };

  const handleDelete = async (order: ProductionOrder) => {
    if (
      window.confirm(
        `آیا از حذف دستور تولید #${toPersianDigits(order.order_number)} اطمینان دارید؟\nاین عملیات گردش‌های کاردکس و موجودی انبار را به حالت اول بازمی‌گرداند.`
      )
    ) {
      try {
        await deleteProductionOrder(order.id);
        await loadOrders();
        if (onRefreshCommodities) onRefreshCommodities();
      } catch (err: any) {
        alert(err.message || 'خطا در حذف سفارش تولید');
      }
    }
  };

  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) return orders;
    const q = searchQuery.toLowerCase().trim();
    return orders.filter(
      (o) =>
        o.order_number.toString().includes(q) ||
        (o.input_commodity_name && o.input_commodity_name.toLowerCase().includes(q)) ||
        (o.note && o.note.toLowerCase().includes(q))
    );
  }, [orders, searchQuery]);

  const stats = useMemo(() => {
    const totalInput = orders.reduce((sum, o) => sum + (o.input_quantity || 0), 0);
    const totalOutput = orders.reduce((sum, o) => sum + (o.total_output_quantity || 0), 0);
    const totalLoss = orders.reduce((sum, o) => sum + (o.loss_quantity || 0), 0);
    const avgYield = totalInput > 0 ? (totalOutput / totalInput) * 100 : 0;

    return { totalInput, totalOutput, totalLoss, avgYield, count: orders.length };
  }, [orders]);

  return (
    <div className="space-y-4 animate-in fade-in duration-200" dir="rtl">
      
      {/* سربرگ */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Flame className="w-5 h-5 text-amber-600" />
            <span>مدیریت خط تولید و تبدیل ضایعات</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            ثبت فرآیندهای ذوب کوره، شمش‌ریزی، محاسبه درصد بازدهی و رصد افت حرارتی
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>ثبت بچ تولید جدید</span>
          </button>

          <button
            onClick={() => {
              loadOrders();
              if (onRefreshCommodities) onRefreshCommodities();
            }}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            title="به‌روزرسانی داده‌ها"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* کارت‌های شاخص */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 block mb-1">کل مواد اولیه مصرفی</span>
            <div className="text-base font-extrabold text-slate-900 font-mono">
              {separateThousands(String(stats.totalInput))}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-600 border border-slate-200 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 block mb-1">مجموع محصولات حاصله</span>
            <div className="text-base font-extrabold text-emerald-700 font-mono">
              {separateThousands(String(stats.totalOutput))}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center">
            <ArrowRightLeft className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 block mb-1">مجموع پرت کوره (کسری)</span>
            <div className="text-base font-extrabold text-rose-700 font-mono">
              {separateThousands(String(stats.totalLoss))}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center">
            <Flame className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 block mb-1">میانگین بازده کل دوره</span>
            <div className="text-base font-extrabold text-sky-800 font-mono">
              {toPersianDigits(stats.avgYield.toFixed(1))}٪
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 border border-sky-200 flex items-center justify-center">
            <Percent className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* نوار جستجو */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div className="relative w-72">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجو در شماره بچ، کالا یا شرح..."
            className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl pr-8 pl-3 text-xs focus:outline-none focus:border-amber-500"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
        </div>
        <div className="text-xs text-slate-500 font-medium">
          تعداد بچ‌های ثبت‌شده: <strong className="font-mono text-slate-800">{toPersianDigits(filteredOrders.length)}</strong>
        </div>
      </div>

      {/* جدول فاکتورهای تولید */}
      <div className="bg-white rounded-2xl border border-slate-300 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse border border-slate-300 table-fixed">
            <thead>
              <tr className="bg-slate-100 text-slate-800 text-[11px] font-bold">
                <th className="border border-slate-300 py-2.5 px-2 text-center align-middle" style={{ width: '7%' }}>شماره بچ</th>
                <th className="border border-slate-300 py-2.5 px-2 text-center align-middle" style={{ width: '9%' }}>تاریخ</th>
                <th className="border border-slate-300 py-2.5 px-3 text-center align-middle" style={{ width: '16%' }}>ماده اولیه ورودی</th>
                <th className="border border-slate-300 py-2.5 px-2 text-center align-middle" style={{ width: '10%' }}>وزن ورودی</th>
                <th className="border border-slate-300 py-2.5 px-3 text-center align-middle" style={{ width: '28%' }}>محصولات و خروجی‌های حاصل‌شده</th>
                <th className="border border-slate-300 py-2.5 px-2 text-center align-middle text-rose-700" style={{ width: '10%' }}>پرت کوره</th>
                <th className="border border-slate-300 py-2.5 px-2 text-center align-middle text-sky-800 font-extrabold" style={{ width: '10%' }}>درصد بازدهی</th>
                <th className="border border-slate-300 py-2.5 px-2 text-center align-middle" style={{ width: '10%' }}>عملیات</th>
                <th className="border border-slate-300 py-2.5 px-2 text-center align-middle text-amber-900 font-bold" style={{ width: '12%' }}>قیمت تمام‌شده (هر واحد)</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="border border-slate-300 p-10 text-center text-slate-400">
                    هیچ بچ تولیدی ثبت نشده است. از دکمه «ثبت بچ تولید جدید» استفاده کنید.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-slate-50 transition-colors">
                    <td className="border border-slate-300 py-2 px-2 text-center align-middle font-mono font-bold text-amber-700 text-xs">
                      #{toPersianDigits(ord.order_number)}
                    </td>
                    <td className="border border-slate-300 py-2 px-2 text-center align-middle font-mono text-slate-800 text-xs font-bold">
                      {toPersianDigits(ord.date_shamsi)}
                    </td>
                    <td className="border border-slate-300 py-2 px-3 text-center align-middle font-bold text-slate-900 truncate">
                      {ord.input_commodity_name}
                    </td>
                    <td className="border border-slate-300 py-2 px-2 text-center align-middle font-mono font-bold text-slate-800 text-xs">
                      {toPersianDigits(ord.input_quantity)}
                    </td>
                    
                    <td className="border border-slate-300 py-2 px-3 align-middle">
                      <div className="space-y-1">
                        {ord.outputs?.map((out, idx) => (
                          <div key={idx} className="flex items-center justify-between text-[11px] bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                            <span className="font-bold text-slate-800 truncate">{out.commodity_name}:</span>
                            <span className="font-mono text-slate-700">
                              {toPersianDigits(out.quantity)} <span className="text-[10px] text-emerald-700 font-bold">({toPersianDigits(out.percentage.toFixed(1))}٪)</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="border border-slate-300 py-2 px-2 text-center align-middle font-mono font-bold text-xs text-amber-900">
  {ord.cost_per_unit && ord.cost_per_unit > 0 ? (
    <div>
      <span>{separateThousands(String(Math.round(ord.cost_per_unit)))}</span>
      <span className="text-[9px] text-slate-500 font-normal block">ریال</span>
    </div>
  ) : (
    <span className="text-slate-400 font-normal">-</span>
  )}
</td>

                    <td className="border border-slate-300 py-2 px-2 text-center align-middle font-mono font-bold text-rose-700 text-xs">
                      {toPersianDigits(ord.loss_quantity.toFixed(1))}
                    </td>

                    <td className="border border-slate-300 py-2 px-2 text-center align-middle font-mono font-extrabold text-sky-800 text-xs">
                      {toPersianDigits(ord.yield_percentage.toFixed(1))}٪
                    </td>

                    <td className="border border-slate-300 py-2 px-2 text-center align-middle">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleOpenView(ord)}
                          className="p-1 rounded-lg border border-slate-200 text-slate-600 hover:text-amber-700 hover:bg-slate-100 transition-colors cursor-pointer"
                          title="مشاهده فاکتور تولید"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(ord)}
                          className="p-1 rounded-lg border border-slate-200 text-slate-600 hover:text-sky-700 hover:bg-slate-100 transition-colors cursor-pointer"
                          title="ویرایش بچ تولید"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(ord)}
                          className="p-1 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="حذف بچ تولید"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* مودال ثبت و ویرایش */}
      <ProductionModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setOrderToEdit(null);
        }}
        orderToEdit={orderToEdit}
        commodities={commodities}
        warehouses={warehouses}
        onSuccess={() => {
          loadOrders();
          if (onRefreshCommodities) onRefreshCommodities();
        }}
      />

      {/* مودال مشاهده جزئیات تولید */}
      <ProductionViewModal
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false);
          setOrderToView(null);
        }}
        order={orderToView}
      />

    </div>
  );
};