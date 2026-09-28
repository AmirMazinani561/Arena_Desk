import React from 'react';
import { X, Flame, Printer, Layers, ArrowRightLeft, FileText, DollarSign } from 'lucide-react';
import type { ProductionOrder } from '../db/types';
import { toPersianDigits, separateThousands } from '../utils/dateUtils';

interface ProductionViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: ProductionOrder | null;
}

export const ProductionViewModal: React.FC<ProductionViewModalProps> = ({
  isOpen,
  onClose,
  order,
}) => {
  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs" dir="rtl">
      <div className="bg-white rounded-2xl border border-slate-300 shadow-2xl w-[90vw] max-w-7xl h-[90vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
        
        {/* سربرگ */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-xs">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-extrabold text-slate-900">
                  جزئیات بچ تولید #{toPersianDigits(order.order_number)}
                </h2>
                <span className="text-[11px] px-2.5 py-0.5 rounded-md font-mono font-bold bg-white text-amber-800 border border-amber-300">
                  تاریخ: {toPersianDigits(order.date_shamsi)}
                </span>
                {order.purchase_invoice_number && (
                  <span className="text-[11px] px-2.5 py-0.5 rounded-md font-bold bg-sky-50 text-sky-800 border border-sky-200">
                    مرجع: فاکتور خرید #{toPersianDigits(order.purchase_invoice_number)}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">گزارش کامل مصرف ماده اولیه، هزینه‌ها، بهای تمام‌شده و افت حرارتی</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="p-2 rounded-xl text-slate-600 hover:bg-slate-200 border border-slate-300 bg-white transition-colors cursor-pointer"
              title="چاپ برگه تولید"
            >
              <Printer className="w-4 h-4 text-amber-600" />
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

        {/* محتوای اسکرول‌خور */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30">
          
          {/* مشخصات ماده اولیه ورودی */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2.5">
              <Layers className="w-4 h-4 text-amber-600" />
              <span>مشخصات خوراک و ماده اولیه مصرف‌شده (شارژ کوره)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 block mb-1">کالای ورودی:</span>
                <strong className="text-slate-900 text-sm">{order.input_commodity_name || 'نامشخص'}</strong>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 block mb-1">انبار مبدأ:</span>
                <strong className="text-slate-800 text-sm">{order.input_warehouse_name || 'انبار اصلی'}</strong>
              </div>

              <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200">
                <span className="text-amber-800 block mb-1 font-bold">وزن کل ورودی:</span>
                <strong className="text-amber-950 font-mono text-base">{toPersianDigits(order.input_quantity)}</strong>
              </div>
            </div>
          </div>

          {/* کادر آنالیز هزینه‌ها و بهای تمام‌شده (در صورت ثبت شدن) */}
          {(order.cost_per_unit || 0) > 0 && (
            <div className="bg-white p-5 rounded-2xl border border-amber-200 shadow-2xs space-y-3">
              <h3 className="text-xs font-bold text-amber-950 flex items-center gap-2 border-b border-amber-100 pb-2.5">
                <DollarSign className="w-4 h-4 text-amber-600" />
                <span>آنالیز هزینه‌ها و محاسبه بهای تمام‌شده واحد</span>
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block mb-0.5">نرخ خرید هر کیلو ماده:</span>
                  <strong className="font-mono text-slate-800">{separateThousands(String(order.input_unit_price || 0))} ریال</strong>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block mb-0.5">دستمزد کوره / تولید:</span>
                  <strong className="font-mono text-slate-800">{separateThousands(String(order.wage_cost || 0))} ریال</strong>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block mb-0.5">کرایه حمل و نقل:</span>
                  <strong className="font-mono text-slate-800">{separateThousands(String(order.transport_cost || 0))} ریال</strong>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block mb-0.5">هزینه‌های جانبی:</span>
                  <strong className="font-mono text-slate-800">{separateThousands(String(order.overhead_cost || 0))} ریال</strong>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between p-3.5 bg-amber-50 rounded-xl border border-amber-300 text-xs">
                <div>
                  <span className="text-slate-600 font-bold">بهای تمام‌شده کل این بچ تولید: </span>
                  <strong className="font-mono text-slate-900 text-sm">{separateThousands(String(Math.round(order.total_production_cost || 0)))} ریال</strong>
                </div>

                <div className="bg-amber-600 text-white px-4 py-2 rounded-xl shadow-xs font-bold text-xs flex items-center gap-2">
                  <span>قیمت تمام‌شده هر کیلوگرم محصول:</span>
                  <strong className="font-mono text-sm">{separateThousands(String(Math.round(order.cost_per_unit || 0)))} ریال</strong>
                </div>
              </div>
            </div>
          )}

          {/* جدول تفکیکی خروجی‌ها */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2.5">
              <ArrowRightLeft className="w-4 h-4 text-emerald-600" />
              <span>محصولات و خروجی‌های حاصل‌شده از این بچ تولید</span>
            </h3>

            <div className="border border-slate-300 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-xs border-collapse border border-slate-300 table-fixed">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 text-[11px] font-bold">
                    <th className="border border-slate-300 py-3 px-2 text-center" style={{ width: '8%' }}>ردیف</th>
                    <th className="border border-slate-300 py-3 px-3 text-center" style={{ width: '32%' }}>نام محصول خروجی</th>
                    <th className="border border-slate-300 py-3 px-2 text-center" style={{ width: '20%' }}>انبار مقصد</th>
                    <th className="border border-slate-300 py-3 px-2 text-center" style={{ width: '15%' }}>وزن / مقدار</th>
                    <th className="border border-slate-300 py-3 px-2 text-center" style={{ width: '12%' }}>درصد سهم</th>
                    <th className="border border-slate-300 py-3 px-3 text-center" style={{ width: '13%' }}>شرح / یادداشت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {order.outputs?.map((out, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="border border-slate-300 py-2.5 px-2 text-center font-mono font-bold text-slate-700">
                        {toPersianDigits(idx + 1)}
                      </td>
                      <td className="border border-slate-300 py-2.5 px-3 text-center font-bold text-slate-900 truncate">
                        {out.commodity_name}
                      </td>
                      <td className="border border-slate-300 py-2.5 px-2 text-center text-slate-700">
                        {out.warehouse_name || 'انبار مقصد'}
                      </td>
                      <td className="border border-slate-300 py-2.5 px-2 text-center font-mono font-bold text-emerald-800 text-xs">
                        {toPersianDigits(out.quantity)}
                      </td>
                      <td className="border border-slate-300 py-2.5 px-2 text-center font-mono font-bold text-sky-800 text-xs">
                        {toPersianDigits(out.percentage.toFixed(1))}٪
                      </td>
                      <td className="border border-slate-300 py-2.5 px-3 text-center text-slate-600 truncate">
                        {out.note || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {order.note && (
            <div className="bg-white p-4 rounded-xl border border-slate-200 text-xs text-slate-700 flex items-start gap-2.5">
              <FileText className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-900 block mb-1">توضیحات و گزارش شیفت:</span>
                <p className="leading-relaxed text-slate-600">{order.note}</p>
              </div>
            </div>
          )}

        </div>

        {/* فوتر */}
        <div className="border-t border-slate-300 bg-slate-50/70 p-4 space-y-3 shrink-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-center">
            <div className="bg-white p-3 rounded-xl border border-slate-300 shadow-2xs">
              <span className="text-[11px] text-slate-500 font-bold block mb-1">کل وزن ورودی کوره</span>
              <div className="font-mono font-bold text-slate-900 text-sm">
                {separateThousands(String(order.input_quantity))}
              </div>
            </div>

            <div className="bg-white p-3 rounded-xl border border-emerald-300 shadow-2xs">
              <span className="text-[11px] text-emerald-800 font-bold block mb-1">مجموع محصولات حاصله</span>
              <div className="font-mono font-bold text-emerald-900 text-sm">
                {separateThousands(String(order.total_output_quantity))}
              </div>
            </div>

            <div className="bg-white p-3 rounded-xl border border-rose-300 shadow-2xs">
              <span className="text-[11px] text-rose-800 font-bold block mb-1">پرت و افت حرارتی کوره</span>
              <div className="font-mono font-bold text-rose-900 text-sm">
                {toPersianDigits(order.loss_quantity.toFixed(1))}
              </div>
            </div>

            <div className="bg-sky-50/80 p-3 rounded-xl border border-sky-300 shadow-2xs">
              <span className="text-[11px] text-sky-800 font-extrabold block mb-1">راندمان نهایی بازدهی</span>
              <div className="font-mono font-extrabold text-sky-950 text-base">
                {toPersianDigits(order.yield_percentage.toFixed(1))}٪
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200 flex items-center justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-bold transition-colors cursor-pointer shadow-2xs"
            >
              بستن پنجره
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};